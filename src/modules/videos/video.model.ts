import mongoose, { Schema } from 'mongoose';

export type VideoStatus = 'uploaded' | 'processing' | 'ready' | 'flagged' | 'failed';
export type Sensitivity = 'safe' | 'flagged' | 'unknown';

export interface VideoDocument {
  videoId: string;
  ownerUserId: string;
  originalName: string;
  storedFileName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  status: VideoStatus;
  sensitivity: Sensitivity;
  progress: number;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const videoSchema = new Schema<VideoDocument>(
  {
    videoId: {
      type: String,
      required: true,
      unique: true,
      default: () => new mongoose.Types.ObjectId().toHexString(),
    },
    ownerUserId: { type: String, required: true, index: true },
    originalName: { type: String, required: true },
    storedFileName: { type: String, required: true },
    storagePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    status: {
      type: String,
      enum: ['uploaded', 'processing', 'ready', 'flagged', 'failed'],
      default: 'uploaded',
      index: true,
    },
    sensitivity: {
      type: String,
      enum: ['safe', 'flagged', 'unknown'],
      default: 'unknown',
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    errorMessage: { type: String, required: false },
  },
  { timestamps: true }
);

videoSchema.index({ ownerUserId: 1, createdAt: -1 });

export const VideoModel = mongoose.model<VideoDocument>('Video', videoSchema);
