import type { NextFunction, Request, Response } from 'express';
import multer from "multer";
import { HttpError } from '../utils/http-error.js';

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }

  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    res.status(413).json({ message: "Video file size must be 20MB or less" });
    return;
  }

  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
};
