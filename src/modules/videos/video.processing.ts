import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import type { Server as SocketServer } from "socket.io";
import { PROCESSING_TMP_DIR } from "../../config/storage.js";
import type { Sensitivity, VideoStatus, VideoVariant } from "./video.model.js";
import { ObjectStorageService } from "./object-storage.js";
import { VideoRepository } from "./video.repository.js";
import {
  estimateBlackContentRatio,
  ffprobeVideo,
  getDurationSec,
  getVideoStream,
  transcodeToQuality,
  type TranscodeQuality,
} from "./ffmpeg-runner.js";

const QUALITIES: TranscodeQuality[] = ["240", "480", "720"];

export class VideoProcessingService {
  constructor(
    private readonly videoRepository: VideoRepository,
    private readonly io: SocketServer,
    private readonly objectStorage: ObjectStorageService,
  ) {}

  startProcessing(videoId: string, ownerUserId: string, originalName: string): void {
    void this.runPipeline(videoId, ownerUserId, originalName);
  }

  private emitProgress(
    ownerUserId: string,
    payload: {
      videoId: string;
      phase: string;
      progress: number;
      status: VideoStatus;
    },
  ): void {
    this.io.to(ownerUserId).emit("video:progress", payload);
  }

  private async runPipeline(
    videoId: string,
    ownerUserId: string,
    originalName: string,
  ): Promise<void> {
    const video = await this.videoRepository.findByVideoId(videoId);
    if (!video) return;

    let workingPath = video.storagePath;
    const keyPrefix = `videos/${videoId}`;
    const uploadedKeys: string[] = [];
    const processingDir = path.join(PROCESSING_TMP_DIR, videoId);

    try {
      this.objectStorage.assertConfigured();
      await this.videoRepository.updateProcessing(videoId, {
        status: "processing",
        progress: 5,
      });
      this.emitProgress(ownerUserId, {
        videoId,
        phase: "layout",
        progress: 5,
        status: "processing",
      });

      await mkdir(processingDir, { recursive: true });

      const ext =
        path.extname(originalName) ||
        path.extname(video.storedFileName) ||
        ".mp4";
      const canonicalOriginal = path.join(processingDir, `original${ext}`);
      await rename(workingPath, canonicalOriginal);
      workingPath = canonicalOriginal;

      // Keep local path in DB while processing; only compressed variants are uploaded to Tigris.
      await this.videoRepository.updateProcessing(videoId, {
        storagePath: workingPath,
        progress: 10,
      });

      const probe = await ffprobeVideo(workingPath);
      const videoStream = getVideoStream(probe);
      const durationSec = getDurationSec(probe);

      const blackRatio = await estimateBlackContentRatio(workingPath, durationSec);

      const sensitivity = this.classifySensitivity({
        originalName,
        hasVideoStream: Boolean(videoStream),
        durationSec,
        blackRatio,
      });

      const analysisSummary = [
        `durationSec=${durationSec.toFixed(2)}`,
        `hasVideo=${Boolean(videoStream)}`,
        `blackRatio=${blackRatio.toFixed(3)}`,
        `sensitivity=${sensitivity}`,
      ].join("; ");

      await this.videoRepository.updateProcessing(videoId, {
        sensitivity,
        progress: 25,
        analysisSummary,
      });

      this.emitProgress(ownerUserId, {
        videoId,
        phase: "sensitivityAnalysis",
        progress: 30,
        status: "processing",
      });

      const variants: VideoVariant[] = [];
      let step = 0;
      for (const q of QUALITIES) {
        const outFile = path.join(processingDir, `${q}.mp4`);
        await transcodeToQuality(workingPath, outFile, q);
        const st = await stat(outFile);
        const key = `${keyPrefix}/${q}.mp4`;
        variants.push({
          quality: q,
          height: Number(q),
          storagePath: key,
          sizeBytes: st.size,
        });
        step += 1;
        const progress = 30 + Math.round((step / QUALITIES.length) * 60);
        await this.videoRepository.updateProcessing(videoId, {
          progress,
          variants: [...variants],
        });
        this.emitProgress(ownerUserId, {
          videoId,
          phase: `transcode_${q}`,
          progress,
          status: "processing",
        });
      }

      for (const variant of variants) {
        const outFile = path.join(processingDir, `${variant.quality}.mp4`);
        await this.objectStorage.uploadFromFile(
          variant.storagePath,
          outFile,
          "video/mp4",
        );
        uploadedKeys.push(variant.storagePath);
      }

      const finalStatus: VideoStatus = sensitivity === "flagged" ? "flagged" : "ready";

      await this.videoRepository.updateProcessing(videoId, {
        status: finalStatus,
        progress: 100,
        variants,
        sensitivity,
        // Canonical reference: highest quality MP4 only (original is not stored remotely).
        storagePath: `${keyPrefix}/720.mp4`,
      });

      this.io.to(ownerUserId).emit("video:status", {
        videoId,
        status: finalStatus,
        sensitivity,
      });
      await rm(processingDir, { recursive: true, force: true });
    } catch {
      for (const key of uploadedKeys) {
        try {
          await this.objectStorage.deleteObject(key);
        } catch {
          // Best effort cleanup for partially uploaded objects.
        }
      }
      try {
        await rm(processingDir, { recursive: true, force: true });
      } catch {
        // Best effort cleanup for temp workspace.
      }
      await this.videoRepository.updateProcessing(videoId, {
        status: "failed",
        progress: 100,
        errorMessage: "Processing failed",
      });

      this.io.to(ownerUserId).emit("video:error", {
        videoId,
        status: "failed",
      });
    }
  }

  private classifySensitivity(input: {
    originalName: string;
    hasVideoStream: boolean;
    durationSec: number;
    blackRatio: number;
  }): Sensitivity {
    const lowered = input.originalName.toLowerCase();
    if (
      lowered.includes("nsfw") ||
      lowered.includes("sensitive") ||
      lowered.includes("flagged")
    ) {
      return "flagged";
    }
    if (!input.hasVideoStream) return "flagged";
    if (input.durationSec < 0.5) return "flagged";
    if (input.blackRatio > 0.85) return "flagged";
    return "safe";
  }
}
