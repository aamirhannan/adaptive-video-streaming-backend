import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoService } from './video.service.js';

describe('VideoService', () => {
  const repo = {
    create: vi.fn(),
    listByOwner: vi.fn(),
    listByVideoIds: vi.fn(),
    findByVideoIdForOwner: vi.fn(),
    findByVideoId: vi.fn(),
    updateProcessing: vi.fn(),
  };
  const videoShareRepo = {
    findByVideoIdAndSharedWithUser: vi.fn(),
    listVideoIdsSharedWithUser: vi.fn(),
  };
  const processing = {
    startProcessing: vi.fn(),
  };
  const objectStorage = {
    isConfigured: vi.fn(),
    statObject: vi.fn(),
    getObjectStream: vi.fn(),
    deleteByPrefix: vi.fn(),
  };
  const owner = { userId: 'u1', email: 'u@x.com', role: 'viewer' as const };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enforces owner isolation lookup', async () => {
    repo.findByVideoId.mockResolvedValue(null);
    const service = new VideoService(
      repo as never,
      processing as never,
      videoShareRepo as never,
      objectStorage as never,
    );

    await expect(service.getOwnVideo(owner, 'v1')).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.findByVideoId).toHaveBeenCalledWith('v1');
  });

  it('blocks stream for non-ready statuses', async () => {
    repo.findByVideoId.mockResolvedValue({
      videoId: 'v1',
      ownerUserId: 'u1',
      status: 'processing',
      sensitivity: 'unknown',
      storagePath: 'storage/videos/a.mp4',
      mimeType: 'video/mp4',
      variants: [],
    });
    videoShareRepo.findByVideoIdAndSharedWithUser.mockResolvedValue(null);
    const service = new VideoService(
      repo as never,
      processing as never,
      videoShareRepo as never,
      objectStorage as never,
    );

    await expect(service.getStreamPayload(owner, 'v1')).rejects.toMatchObject({ statusCode: 409 });
  });
});
