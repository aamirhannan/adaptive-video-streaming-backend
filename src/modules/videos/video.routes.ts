import { Router } from "express";
import type { Server as SocketServer } from "socket.io";
import {
  authMiddleware,
  streamAuthMiddleware,
} from "../../middleware/auth-middleware.js";
import { requireRoles } from "../../middleware/role-middleware.js";
import { UserRepository } from "../users/user.repository.js";
import { VideoController } from "./video.controller.js";
import { ObjectStorageService } from "./object-storage.js";
import { VideoProcessingService } from "./video.processing.js";
import { VideoRepository } from "./video.repository.js";
import { VideoService } from "./video.service.js";
import { VideoShareController } from "./video-share.controller.js";
import { VideoShareRepository } from "./video-share.repository.js";
import { VideoShareService } from "./video-share.service.js";
import { uploadVideoMiddleware } from "./video.upload.js";

export const createVideoRouter = (io: SocketServer) => {
  const videoRepository = new VideoRepository();
  const videoShareRepository = new VideoShareRepository();
  const userRepository = new UserRepository();
  const objectStorage = new ObjectStorageService();
  const videoProcessingService = new VideoProcessingService(
    videoRepository,
    io,
    objectStorage,
  );
  const videoService = new VideoService(
    videoRepository,
    videoProcessingService,
    videoShareRepository,
    objectStorage,
  );
  const videoShareService = new VideoShareService(
    videoRepository,
    videoShareRepository,
    userRepository,
  );
  const videoController = new VideoController(videoService);
  const videoShareController = new VideoShareController(videoShareService);

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
  router.post(
    "/:videoId/shares",
    authMiddleware,
    requireRoles(["editor", "admin"]),
    videoShareController.createShare,
  );
  router.get(
    "/:videoId/shares",
    authMiddleware,
    requireRoles(["editor", "admin"]),
    videoShareController.listShares,
  );
  router.delete(
    "/:videoId/shares/:shareId",
    authMiddleware,
    requireRoles(["editor", "admin"]),
    videoShareController.removeShare,
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
  router.delete(
    "/:videoId",
    authMiddleware,
    requireRoles(["editor", "admin"]),
    videoController.remove,
  );

  return router;
};
