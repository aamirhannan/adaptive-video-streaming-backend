import { Router } from "express";
import type { Server as SocketServer } from "socket.io";
import {
  authMiddleware,
  streamAuthMiddleware,
} from "../../middleware/auth-middleware.js";
import { requireRoles } from "../../middleware/role-middleware.js";
import { VideoController } from "./video.controller.js";
import { VideoProcessingService } from "./video.processing.js";
import { VideoRepository } from "./video.repository.js";
import { VideoService } from "./video.service.js";
import { uploadVideoMiddleware } from "./video.upload.js";

export const createVideoRouter = (io: SocketServer) => {
  const videoRepository = new VideoRepository();
  const videoProcessingService = new VideoProcessingService(
    videoRepository,
    io,
  );
  const videoService = new VideoService(
    videoRepository,
    videoProcessingService,
  );
  const videoController = new VideoController(videoService);

  const router = Router();

  router.post(
    "/upload",
    authMiddleware,
    requireRoles(["editor", "admin"]),
    uploadVideoMiddleware.single("video"),
    videoController.upload,
  );
  router.get(
    "/",
    authMiddleware,
    requireRoles(["viewer", "editor", "admin"]),
    videoController.list,
  );
  router.get(
    "/:videoId/stream",
    streamAuthMiddleware,
    requireRoles(["viewer", "editor", "admin"]),
    videoController.stream,
  );
  router.get(
    "/:videoId",
    authMiddleware,
    requireRoles(["viewer", "editor", "admin"]),
    videoController.getById,
  );
  router.patch(
    "/:videoId/status",
    authMiddleware,
    requireRoles(["admin"]),
    videoController.patchStatus,
  );

  return router;
};
