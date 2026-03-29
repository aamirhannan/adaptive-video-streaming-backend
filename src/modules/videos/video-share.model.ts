import mongoose, { Schema } from "mongoose";

export interface VideoShareDocument {
  shareId: string;
  videoId: string;
  sharedWithUserId: string;
  sharedByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

const videoShareSchema = new Schema<VideoShareDocument>(
  {
    shareId: {
      type: String,
      required: true,
      unique: true,
      default: () => new mongoose.Types.ObjectId().toHexString(),
    },
    videoId: { type: String, required: true, index: true },
    sharedWithUserId: { type: String, required: true, index: true },
    sharedByUserId: { type: String, required: true },
  },
  { timestamps: true },
);

videoShareSchema.index({ videoId: 1, sharedWithUserId: 1 }, { unique: true });

export const VideoShareModel = mongoose.model<VideoShareDocument>(
  "VideoShare",
  videoShareSchema,
);
