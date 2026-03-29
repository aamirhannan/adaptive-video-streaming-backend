import { mkdir, rename, stat } from "node:fs/promises";
import path from "node:path";
import type { Server as SocketServer } from "socket.io";
import { VIDEO_STORAGE_DIR } from "../../config/storage.js";
import type { Sensitivity, VideoStatus, VideoVariant } from "./video.model.js";
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

    try {
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

      const dir = path.join(VIDEO_STORAGE_DIR, videoId);
      await mkdir(dir, { recursive: true });

      const ext =
        path.extname(originalName) ||
        path.extname(video.storedFileName) ||
        ".mp4";
      const canonicalOriginal = path.join(dir, `original${ext}`);
      await rename(workingPath, canonicalOriginal);
      workingPath = canonicalOriginal;

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
        const outFile = path.join(dir, `${q}.mp4`);
        await transcodeToQuality(workingPath, outFile, q);
        const st = await stat(outFile);
        variants.push({
          quality: q,
          height: Number(q),
          storagePath: outFile,
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

      const finalStatus: VideoStatus = sensitivity === "flagged" ? "flagged" : "ready";

      await this.videoRepository.updateProcessing(videoId, {
        status: finalStatus,
        progress: 100,
        variants,
        sensitivity,
      });

      this.io.to(ownerUserId).emit("video:status", {
        videoId,
        status: finalStatus,
        sensitivity,
      });
    } catch {
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
