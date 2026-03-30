import { describe, expect, it } from 'vitest';
import { isAllowedVideoMimeType, maxFileSize } from './video.upload.js';

describe('video upload validation', () => {
  it('accepts supported video mime types', () => {
    expect(isAllowedVideoMimeType('video/mp4')).toBe(true);
    expect(isAllowedVideoMimeType('video/webm')).toBe(true);
  });

  it('rejects unsupported mime types', () => {
    expect(isAllowedVideoMimeType('image/png')).toBe(false);
  });

  it('enforces 20MB file size limit', () => {
    expect(maxFileSize).toBe(20 * 1024 * 1024);
  });
});
