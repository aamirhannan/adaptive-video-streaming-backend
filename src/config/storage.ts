import path from 'node:path';

export const STORAGE_ROOT = path.resolve(process.cwd(), 'storage');
export const VIDEO_STORAGE_DIR = path.join(STORAGE_ROOT, 'videos');
