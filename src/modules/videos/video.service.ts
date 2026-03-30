import path from "node:path";
import { promises as fs } from "node:fs";
import { HttpError } from "../../utils/http-error.js";
import type { AuthUser } from "../../types/auth.js";
import { UPLOAD_TMP_DIR, VIDEO_STORAGE_DIR } from "../../config/storage.js";
import type {
  Sensitivity,
  StreamQuality,
  VideoStatus,
  VideoDocument,
} from "./video.model.js";
import { VideoRepository } from "./video.repository.js";
import { VideoProcessingService } from "./video.processing.js";
import { VideoShareRepository } from "./video-share.repository.js";
import { ObjectStorageService } from "./object-storage.js";

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
    private readonly videoShareRepository: VideoShareRepository,
    private readonly objectStorage: ObjectStorageService,
  ) {}

  async createAndProcessVideo(owner: AuthUser, input: UploadInput) {
    const storagePath = path.join(UPLOAD_TMP_DIR, input.storedFileName);
    const video = await this.videoRepository.create({
      ownerUserId: owner.userId,
      ownerEmail: owner.email,
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

  private async resolveAccessibleVideo(
    user: AuthUser,
    videoId: string,
  ): Promise<VideoDocument | null> {
    const video = await this.videoRepository.findByVideoId(videoId);
    if (!video) return null;
    if (user.role === "admin") return video;
    if (video.ownerUserId === user.userId) return video;
    const share =
      await this.videoShareRepository.findByVideoIdAndSharedWithUser(
        videoId,
        user.userId,
      );
    if (share) return video;
    return null;
  }

  /**
   * Admin: all videos. Others: owned plus videos shared with this user.
   */
  async listOwnVideos(owner: AuthUser, filters: ListFilters) {
    if (owner.role === "admin") {
      return this.videoRepository.listAll(filters);
    }

    const owned = await this.videoRepository.listByOwner(owner.userId, filters);
    const sharedIds =
      await this.videoShareRepository.listVideoIdsSharedWithUser(owner.userId);
    const shared =
      sharedIds.length > 0
        ? await this.videoRepository.listByVideoIds(sharedIds, filters)
        : [];

    const byId = new Map<string, VideoDocument>();
    for (const v of owned) byId.set(v.videoId, v);
    for (const v of shared) byId.set(v.videoId, v);

    return Array.from(byId.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async getOwnVideo(owner: AuthUser, videoId: string) {
    const video = await this.resolveAccessibleVideo(owner, videoId);
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

  async deleteVideo(actor: AuthUser, videoId: string) {
    if (actor.role !== "editor" && actor.role !== "admin") {
      throw new HttpError(403, "Forbidden");
    }

    const video = await this.videoRepository.findByVideoId(videoId);
    if (!video) throw new HttpError(404, "Video not found");

    if (actor.role === "editor" && video.ownerUserId !== actor.userId) {
      throw new HttpError(403, "Forbidden");
    }

    await this.videoShareRepository.deleteByVideoId(videoId);

    const remotePrefix = `videos/${videoId}`;
    if (this.objectStorage.isConfigured()) {
      try {
        await this.objectStorage.deleteByPrefix(remotePrefix);
      } catch {
        // Keep deletion robust; continue local/DB cleanup.
      }
    }

    // Remove processed folder and legacy single-file storage paths.
    const candidates = new Set<string>();
    if (!video.storagePath.startsWith("videos/")) {
      candidates.add(path.resolve(video.storagePath));
    }
    for (const variant of video.variants ?? []) {
      if (!variant.storagePath.startsWith("videos/")) {
        candidates.add(path.resolve(variant.storagePath));
      }
    }
    candidates.add(path.resolve(path.join(VIDEO_STORAGE_DIR, videoId)));

    for (const candidate of candidates) {
      if (!candidate.startsWith(path.resolve(VIDEO_STORAGE_DIR))) continue;
      try {
        const st = await fs.stat(candidate);
        if (st.isDirectory()) {
          await fs.rm(candidate, { recursive: true, force: true });
        } else {
          await fs.unlink(candidate);
        }
      } catch {
        // Best-effort cleanup; continue with DB deletion.
      }
    }

    const deleted = await this.videoRepository.deleteByVideoId(videoId);
    if (!deleted) throw new HttpError(404, "Video not found");
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

    const selectedPath = variant ? variant.storagePath : video.storagePath;
    const mimeType = variant ? "video/mp4" : video.mimeType;

    if (selectedPath.startsWith("videos/")) {
      if (!this.objectStorage.isConfigured()) {
        throw new HttpError(500, "Object storage is not configured");
      }
      let objectMeta;
      try {
        objectMeta = await this.objectStorage.statObject(selectedPath);
      } catch {
        throw new HttpError(404, "Video file not found");
      }
      return {
        source: "object" as const,
        objectKey: selectedPath,
        fileSize: objectMeta.sizeBytes,
        mimeType: objectMeta.contentType || mimeType,
        quality,
      };
    }

    const fullPath = path.resolve(selectedPath);
    const allowedRoot = path.resolve(VIDEO_STORAGE_DIR);
    const allowedTmp = path.resolve(UPLOAD_TMP_DIR);
    if (!fullPath.startsWith(allowedRoot) && !fullPath.startsWith(allowedTmp)) {
      throw new HttpError(400, "Invalid video path");
    }

    let fileStat;
    try {
      fileStat = await fs.stat(fullPath);
    } catch {
      throw new HttpError(404, "Video file not found");
    }

    return {
      source: "local" as const,
      fullPath,
      fileSize: fileStat.size,
      mimeType,
      quality,
    };
  }

  async getObjectStreamPayload(objectKey: string, byteRange?: string) {
    if (!this.objectStorage.isConfigured()) {
      throw new HttpError(500, "Object storage is not configured");
    }
    try {
      return await this.objectStorage.getObjectStream(objectKey, byteRange);
    } catch {
      throw new HttpError(404, "Video file not found");
    }
  }
}
