import { createReadStream } from "node:fs";
import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth-middleware.js";
import { HttpError } from "../../utils/http-error.js";
import type { Sensitivity, VideoStatus } from "./video.model.js";
import { VideoService } from "./video.service.js";

export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  upload = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.user) throw new HttpError(401, "Unauthorized");
      if (!req.file) throw new HttpError(400, "Video file is required");

      const created = await this.videoService.createAndProcessVideo(req.user, {
        originalName: req.file.originalname,
        storedFileName: req.file.filename,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
      });

      res.status(201).json({ video: created });
    } catch (error) {
      next(error);
    }
  };

  list = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.user) throw new HttpError(401, "Unauthorized");
      const status = req.query.status as VideoStatus | undefined;
      const sensitivity = req.query.sensitivity as Sensitivity | undefined;
      const filters =
        status || sensitivity
          ? ({ status, sensitivity } as {
              status?: VideoStatus;
              sensitivity?: Sensitivity;
            })
          : {};
      const videos = await this.videoService.listOwnVideos(req.user, filters);
      res.status(200).json({ videos });
    } catch (error) {
      next(error);
    }
  };

  getById = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.user) throw new HttpError(401, "Unauthorized");
      const rawVideoId = req.params.videoId;
      const videoId = Array.isArray(rawVideoId) ? rawVideoId[0] : rawVideoId;
      if (!videoId) throw new HttpError(400, "videoId is required");
      const video = await this.videoService.getOwnVideo(req.user, videoId);
      res.status(200).json({ video });
    } catch (error) {
      next(error);
    }
  };

  patchStatus = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const status = req.body?.status as VideoStatus | undefined;
      const rawVideoId = req.params.videoId;
      const videoId = Array.isArray(rawVideoId) ? rawVideoId[0] : rawVideoId;
      if (!status) throw new HttpError(400, "Status is required");
      if (!videoId) throw new HttpError(400, "videoId is required");
      const video = await this.videoService.updateVideoStatusAdmin(
        videoId,
        status,
      );
      res.status(200).json({ video });
    } catch (error) {
      next(error);
    }
  };

  remove = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.user) throw new HttpError(401, "Unauthorized");
      const rawVideoId = req.params.videoId;
      const videoId = Array.isArray(rawVideoId) ? rawVideoId[0] : rawVideoId;
      if (!videoId) throw new HttpError(400, "videoId is required");
      await this.videoService.deleteVideo(req.user, videoId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  stream = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.user) throw new HttpError(401, "Unauthorized");
      const rawVideoId = req.params.videoId;
      const videoId = Array.isArray(rawVideoId) ? rawVideoId[0] : rawVideoId;
      if (!videoId) throw new HttpError(400, "videoId is required");
      const rawQ = req.query.quality;
      const quality: string | undefined =
        typeof rawQ === "string"
          ? rawQ
          : Array.isArray(rawQ) && typeof rawQ[0] === "string"
            ? rawQ[0]
            : undefined;
      const { fullPath, fileSize, mimeType } =
        await this.videoService.getStreamPayload(req.user, videoId, quality);

      const range = req.headers.range;
      if (!range) {
        res.status(200);
        res.set({
          "Content-Length": fileSize,
          "Content-Type": mimeType,
          "Accept-Ranges": "bytes",
        });
        createReadStream(fullPath).pipe(res);
        return;
      }

      const parts = range.replace(/bytes=/, "").split("-");
      const start = Number(parts[0]);
      const end = parts[1] ? Number(parts[1]) : fileSize - 1;

      if (
        Number.isNaN(start) ||
        Number.isNaN(end) ||
        start > end ||
        end >= fileSize
      ) {
        throw new HttpError(416, "Invalid range");
      }

      const chunkSize = end - start + 1;
      res.status(206);
      res.set({
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": mimeType,
      });

      createReadStream(fullPath, { start, end }).pipe(res);
    } catch (error) {
      next(error);
    }
  };
}
