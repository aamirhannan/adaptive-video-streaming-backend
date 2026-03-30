import {
  VideoShareModel,
  type VideoShareDocument,
} from "./video-share.model.js";

export class VideoShareRepository {
  async create(input: {
    videoId: string;
    sharedWithUserId: string;
    sharedByUserId: string;
  }): Promise<VideoShareDocument> {
    const doc = new VideoShareModel(input);
    return doc.save();
  }

  async findByVideoIdAndSharedWithUser(
    videoId: string,
    sharedWithUserId: string,
  ): Promise<VideoShareDocument | null> {
    return VideoShareModel.findOne({ videoId, sharedWithUserId }).exec();
  }

  async findByShareIdAndVideoId(
    shareId: string,
    videoId: string,
  ): Promise<VideoShareDocument | null> {
    return VideoShareModel.findOne({ shareId, videoId }).exec();
  }

  async listVideoIdsSharedWithUser(sharedWithUserId: string): Promise<string[]> {
    const rows = await VideoShareModel.find({ sharedWithUserId })
      .select("videoId")
      .lean()
      .exec();
    return rows.map((r) => r.videoId);
  }

  async listByVideoId(videoId: string): Promise<VideoShareDocument[]> {
    return VideoShareModel.find({ videoId }).sort({ createdAt: -1 }).exec();
  }

  async deleteByShareId(shareId: string): Promise<boolean> {
    const res = await VideoShareModel.deleteOne({ shareId }).exec();
    return res.deletedCount === 1;
  }

  async deleteByVideoId(videoId: string): Promise<number> {
    const res = await VideoShareModel.deleteMany({ videoId }).exec();
    return res.deletedCount ?? 0;
  }
}
