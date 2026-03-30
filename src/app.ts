import cors from "cors";
import express from "express";
import { adminRouter } from "./modules/users/admin.routes.js";
import { userRouter } from "./modules/users/user.routes.js";

export const createApp = () => {
  const app = express();

  app.use(
    cors({
      origin: [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5000",
        "https://adaptive-video-streaming-frontend.fly.dev",
      ],
      credentials: true,
    }),
  );
  app.use(express.json());

  app.get("/", (_req, res) => {
    res.send("Adaptive Video Streaming API is running");
  });

  app.use("/api/auth", userRouter);
  app.use("/api/admin", adminRouter);

  return app;
};
