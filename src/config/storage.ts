import path from 'node:path';

export const STORAGE_ROOT = path.resolve(process.cwd(), 'storage');
export const VIDEO_STORAGE_DIR = path.join(STORAGE_ROOT, 'videos');
export const UPLOAD_TMP_DIR = path.join(STORAGE_ROOT, 'uploads');
export const PROCESSING_TMP_DIR = path.join(STORAGE_ROOT, 'processing');
