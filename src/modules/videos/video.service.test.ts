import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoService } from './video.service.js';

describe('VideoService', () => {
  const repo = {
    create: vi.fn(),
    listByOwner: vi.fn(),
    listAll: vi.fn(),
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

  it('admin can access any video by id', async () => {
    const admin = { userId: 'admin1', email: 'a@x.com', role: 'admin' as const };
    const doc = {
      videoId: 'v2',
      ownerUserId: 'editor1',
      status: 'ready',
      sensitivity: 'safe' as const,
      storagePath: 'videos/v2/720.mp4',
      mimeType: 'video/mp4',
      variants: [{ quality: '720' as const, height: 720, storagePath: 'videos/v2/720.mp4', sizeBytes: 100 }],
    };
    repo.findByVideoId.mockResolvedValue(doc);
    objectStorage.isConfigured.mockReturnValue(true);
    objectStorage.statObject.mockResolvedValue({ sizeBytes: 100, contentType: 'video/mp4' });
    const service = new VideoService(
      repo as never,
      processing as never,
      videoShareRepo as never,
      objectStorage as never,
    );

    const got = await service.getOwnVideo(admin, 'v2');
    expect(got.videoId).toBe('v2');
    expect(videoShareRepo.findByVideoIdAndSharedWithUser).not.toHaveBeenCalled();
  });

  it('admin list uses listAll', async () => {
    const admin = { userId: 'admin1', email: 'a@x.com', role: 'admin' as const };
    repo.listAll.mockResolvedValue([{ videoId: 'a' }]);
    const service = new VideoService(
      repo as never,
      processing as never,
      videoShareRepo as never,
      objectStorage as never,
    );

    const list = await service.listOwnVideos(admin, {});
    expect(list).toEqual([{ videoId: 'a' }]);
    expect(repo.listAll).toHaveBeenCalledWith({});
    expect(repo.listByOwner).not.toHaveBeenCalled();
  });
});
