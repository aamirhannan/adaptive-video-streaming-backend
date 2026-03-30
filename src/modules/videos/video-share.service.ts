import { HttpError } from "../../utils/http-error.js";
import type { AuthUser } from "../../types/auth.js";
import { UserRepository } from "../users/user.repository.js";
import { VideoRepository } from "./video.repository.js";
import { VideoShareRepository } from "./video-share.repository.js";

export class VideoShareService {
  constructor(
    private readonly videoRepository: VideoRepository,
    private readonly videoShareRepository: VideoShareRepository,
    private readonly userRepository: UserRepository,
  ) {}

  private assertCanManageVideo(actor: AuthUser, ownerUserId: string): void {
    if (actor.role === "admin") return;
    if (actor.role === "editor" && actor.userId === ownerUserId) return;
    throw new HttpError(403, "Forbidden");
  }

  async createShare(
    actor: AuthUser,
    videoId: string,
    sharedWith: string,
  ) {
    if (actor.role !== "editor" && actor.role !== "admin") {
      throw new HttpError(403, "Forbidden");
    }

    const video = await this.videoRepository.findByVideoId(videoId);
    if (!video) throw new HttpError(404, "Video not found");

    this.assertCanManageVideo(actor, video.ownerUserId);

    const identifier = sharedWith.trim();
    if (!identifier) {
      throw new HttpError(400, "sharedWith is required");
    }

    if (identifier === actor.userId || identifier.toLowerCase() === actor.email.toLowerCase()) {
      throw new HttpError(400, "Cannot share with yourself");
    }

    const target = await this.userRepository.findByUserIdOrEmail(identifier);
    if (!target) throw new HttpError(404, "Target user not found");
    if (target.userId === video.ownerUserId) {
      throw new HttpError(400, "Target user is already the video owner");
    }
    if (target.role !== "viewer") {
      throw new HttpError(400, "Video can only be shared with users who have the viewer role");
    }

    const existing = await this.videoShareRepository.findByVideoIdAndSharedWithUser(
      videoId,
      target.userId,
    );
    if (existing) {
      throw new HttpError(409, "Video is already shared with this user");
    }

    return this.videoShareRepository.create({
      videoId,
      sharedWithUserId: target.userId,
      sharedByUserId: actor.userId,
    });
  }

  async listSharesForVideo(actor: AuthUser, videoId: string) {
    if (actor.role !== "editor" && actor.role !== "admin") {
      throw new HttpError(403, "Forbidden");
    }

    const video = await this.videoRepository.findByVideoId(videoId);
    if (!video) throw new HttpError(404, "Video not found");

    this.assertCanManageVideo(actor, video.ownerUserId);

    return this.videoShareRepository.listByVideoId(videoId);
  }

  async removeShare(actor: AuthUser, videoId: string, shareId: string) {
    if (actor.role !== "editor" && actor.role !== "admin") {
      throw new HttpError(403, "Forbidden");
    }

    const share = await this.videoShareRepository.findByShareIdAndVideoId(
      shareId,
      videoId,
    );
    if (!share) throw new HttpError(404, "Share not found");

    const video = await this.videoRepository.findByVideoId(videoId);
    if (!video) throw new HttpError(404, "Video not found");

    this.assertCanManageVideo(actor, video.ownerUserId);

    const deleted = await this.videoShareRepository.deleteByShareId(shareId);
    if (!deleted) throw new HttpError(404, "Share not found");
  }
}
