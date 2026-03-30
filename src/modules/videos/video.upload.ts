import { promises as fs } from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { UPLOAD_TMP_DIR } from '../../config/storage.js';
import { HttpError } from '../../utils/http-error.js';

const allowedMimeTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'];
export const maxFileSize = 20 * 1024 * 1024;

export const isAllowedVideoMimeType = (mimeType: string): boolean => {
  return allowedMimeTypes.includes(mimeType);
};

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      await fs.mkdir(UPLOAD_TMP_DIR, { recursive: true });
      cb(null, UPLOAD_TMP_DIR);
    } catch (error) {
      cb(error as Error, UPLOAD_TMP_DIR);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ext || '.mp4';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

export const uploadVideoMiddleware = multer({
  storage,
  limits: { fileSize: maxFileSize },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedVideoMimeType(file.mimetype)) {
      cb(new HttpError(400, 'Unsupported video format'));
      return;
    }
    cb(null, true);
  },
});
