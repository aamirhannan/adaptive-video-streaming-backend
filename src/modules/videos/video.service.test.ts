import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoService } from './video.service.js';

describe('VideoService', () => {
  const repo = {
    create: vi.fn(),
    listByOwner: vi.fn(),
    findByVideoIdForOwner: vi.fn(),
    updateProcessing: vi.fn(),
  };
  const processing = {
    startProcessing: vi.fn(),
  };
  const owner = { userId: 'u1', email: 'u@x.com', role: 'viewer' as const };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enforces owner isolation lookup', async () => {
    repo.findByVideoIdForOwner.mockResolvedValue(null);
    const service = new VideoService(repo as never, processing as never);

    await expect(service.getOwnVideo(owner, 'v1')).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.findByVideoIdForOwner).toHaveBeenCalledWith('v1', 'u1');
  });

  it('blocks stream for non-ready statuses', async () => {
    repo.findByVideoIdForOwner.mockResolvedValue({
      status: 'processing',
      sensitivity: 'unknown',
      storagePath: 'storage/videos/a.mp4',
      mimeType: 'video/mp4',
    });
    const service = new VideoService(repo as never, processing as never);

    await expect(service.getStreamPayload(owner, 'v1')).rejects.toMatchObject({ statusCode: 409 });
  });
});
