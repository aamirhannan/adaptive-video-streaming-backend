import path from "node:path";
import { promises as fs } from "node:fs";
import { HttpError } from "../../utils/http-error.js";
import type { AuthUser } from "../../types/auth.js";
import { VIDEO_STORAGE_DIR } from "../../config/storage.js";
import type { Sensitivity, StreamQuality, VideoStatus } from "./video.model.js";
import { VideoRepository } from "./video.repository.js";
import { VideoProcessingService } from "./video.processing.js";

type UploadInput = {
  originalName: string;
  storedFileName: string;
  mimeType: string;
  sizeBytes: number;
};

type ListFilters = {
  status?: VideoStatus;
  sensitivity?: Sensitivity;
};

const parseStreamQuality = (raw: string | undefined): StreamQuality => {
  if (raw === undefined || raw === "" || raw === "720") return "720";
  if (raw === "240" || raw === "480") return raw;
  throw new HttpError(400, "quality must be 240, 480, or 720");
};

export class VideoService {
  constructor(
    private readonly videoRepository: VideoRepository,
    private readonly processingService: VideoProcessingService,
  ) {}

  async createAndProcessVideo(owner: AuthUser, input: UploadInput) {
    const storagePath = path.join(VIDEO_STORAGE_DIR, input.storedFileName);
    const video = await this.videoRepository.create({
      ownerUserId: owner.userId,
      originalName: input.originalName,
      storedFileName: input.storedFileName,
      storagePath,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    });

    this.processingService.startProcessing(
      video.videoId,
      owner.userId,
      input.originalName,
    );
    return video;
  }

  async listOwnVideos(owner: AuthUser, filters: ListFilters) {
    return this.videoRepository.listByOwner(owner.userId, filters);
  }

  async getOwnVideo(owner: AuthUser, videoId: string) {
    const video = await this.videoRepository.findByVideoIdForOwner(
      videoId,
      owner.userId,
    );
    if (!video) throw new HttpError(404, "Video not found");
    return video;
  }

  async updateVideoStatusAdmin(videoId: string, status: VideoStatus) {
    const updated = await this.videoRepository.updateProcessing(videoId, {
      status,
    });
    if (!updated) throw new HttpError(404, "Video not found");
    return updated;
  }

  async getStreamPayload(
    owner: AuthUser,
    videoId: string,
    qualityRaw?: string | string[],
  ) {
    const video = await this.getOwnVideo(owner, videoId);
    const quality = parseStreamQuality(
      Array.isArray(qualityRaw) ? qualityRaw[0] : qualityRaw,
    );

    if (
      video.status === "failed" ||
      video.status === "processing" ||
      video.status === "uploaded"
    ) {
      throw new HttpError(409, "Video is not ready for streaming");
    }

    if (video.sensitivity === "flagged" && owner.role === "viewer") {
      throw new HttpError(403, "Flagged content is restricted for viewer role");
    }

    const variant = video.variants?.find((v) => v.quality === quality);
    if (!variant && video.variants && video.variants.length > 0) {
      throw new HttpError(404, "Requested quality is not available");
    }

    const fullPath = variant
      ? path.resolve(variant.storagePath)
      : path.resolve(video.storagePath);

    const allowedRoot = path.resolve(VIDEO_STORAGE_DIR);
    if (!fullPath.startsWith(allowedRoot)) {
      throw new HttpError(400, "Invalid video path");
    }

    let fileStat;
    try {
      fileStat = await fs.stat(fullPath);
    } catch {
      throw new HttpError(404, "Video file not found");
    }

    const mimeType = variant ? "video/mp4" : video.mimeType;

    return {
      fullPath,
      fileSize: fileStat.size,
      mimeType,
      quality,
    };
  }
}
