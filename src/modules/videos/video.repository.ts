import { VideoModel, type Sensitivity, type VideoDocument, type VideoStatus } from './video.model.js';

type CreateVideoInput = {
  ownerUserId: string;
  originalName: string;
  storedFileName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
};

type UpdateProcessingInput = {
  status?: VideoStatus;
  sensitivity?: Sensitivity;
  progress?: number;
  errorMessage?: string;
};

type VideoFilters = {
  status?: VideoStatus;
  sensitivity?: Sensitivity;
};

export class VideoRepository {
  async create(input: CreateVideoInput): Promise<VideoDocument> {
    const video = new VideoModel(input);
    return video.save();
  }

  async listByOwner(ownerUserId: string, filters: VideoFilters): Promise<VideoDocument[]> {
    const query: { ownerUserId: string; status?: VideoStatus; sensitivity?: Sensitivity } = {
      ownerUserId,
    };

    if (filters.status) query.status = filters.status;
    if (filters.sensitivity) query.sensitivity = filters.sensitivity;

    return VideoModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async findByVideoIdForOwner(videoId: string, ownerUserId: string): Promise<VideoDocument | null> {
    return VideoModel.findOne({ videoId, ownerUserId }).exec();
  }

  async findByVideoId(videoId: string): Promise<VideoDocument | null> {
    return VideoModel.findOne({ videoId }).exec();
  }

  async updateProcessing(videoId: string, updates: UpdateProcessingInput): Promise<VideoDocument | null> {
    return VideoModel.findOneAndUpdate({ videoId }, updates, { new: true }).exec();
  }
}
