import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth-middleware.js";
import { HttpError } from "../../utils/http-error.js";
import { VideoShareService } from "./video-share.service.js";

export class VideoShareController {
  constructor(private readonly videoShareService: VideoShareService) {}

  createShare = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.user) throw new HttpError(401, "Unauthorized");
      const rawVideoId = req.params.videoId;
      const videoId = Array.isArray(rawVideoId) ? rawVideoId[0] : rawVideoId;
      if (!videoId) throw new HttpError(400, "videoId is required");
      const sharedWithUserId = req.body?.sharedWithUserId as string | undefined;
      if (!sharedWithUserId || typeof sharedWithUserId !== "string") {
        throw new HttpError(400, "sharedWithUserId is required");
      }

      const share = await this.videoShareService.createShare(
        req.user,
        videoId,
        sharedWithUserId.trim(),
      );
      res.status(201).json({ share });
    } catch (error) {
      next(error);
    }
  };

  listShares = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.user) throw new HttpError(401, "Unauthorized");
      const rawVideoId = req.params.videoId;
      const videoId = Array.isArray(rawVideoId) ? rawVideoId[0] : rawVideoId;
      if (!videoId) throw new HttpError(400, "videoId is required");

      const shares = await this.videoShareService.listSharesForVideo(
        req.user,
        videoId,
      );
      res.status(200).json({ shares });
    } catch (error) {
      next(error);
    }
  };

  removeShare = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.user) throw new HttpError(401, "Unauthorized");
      const rawVideoId = req.params.videoId;
      const videoId = Array.isArray(rawVideoId) ? rawVideoId[0] : rawVideoId;
      const rawShareId = req.params.shareId;
      const shareId = Array.isArray(rawShareId) ? rawShareId[0] : rawShareId;
      if (!videoId) throw new HttpError(400, "videoId is required");
      if (!shareId) throw new HttpError(400, "shareId is required");

      await this.videoShareService.removeShare(req.user, videoId, shareId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
