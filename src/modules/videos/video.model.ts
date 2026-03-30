import mongoose, { Schema } from "mongoose";

export type VideoStatus =
  | "uploaded"
  | "processing"
  | "ready"
  | "flagged"
  | "failed";
export type Sensitivity = "safe" | "flagged" | "unknown";

export type StreamQuality = "240" | "480" | "720";

export interface VideoVariant {
  quality: StreamQuality;
  height: number;
  storagePath: string;
  sizeBytes: number;
}

export interface VideoDocument {
  videoId: string;
  ownerUserId: string;
  ownerEmail: string;
  originalName: string;
  storedFileName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  status: VideoStatus;
  sensitivity: Sensitivity;
  progress: number;
  errorMessage?: string;
  variants: VideoVariant[];
  analysisSummary?: string;
  createdAt: Date;
  updatedAt: Date;
}

const videoVariantSchema = new Schema<VideoVariant>(
  {
    quality: {
      type: String,
      enum: ["240", "480", "720"],
      required: true,
    },
    height: { type: Number, required: true },
    storagePath: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
  },
  { _id: false },
);

const videoSchema = new Schema<VideoDocument>(
  {
    videoId: {
      type: String,
      required: true,
      unique: true,
      default: () => new mongoose.Types.ObjectId().toHexString(),
    },
    ownerUserId: { type: String, required: true, index: true },
    ownerEmail: { type: String, required: true, lowercase: true, trim: true },
    originalName: { type: String, required: true },
    storedFileName: { type: String, required: true },
    storagePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    status: {
      type: String,
      enum: ["uploaded", "processing", "ready", "flagged", "failed"],
      default: "uploaded",
      index: true,
    },
    sensitivity: {
      type: String,
      enum: ["safe", "flagged", "unknown"],
      default: "unknown",
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    errorMessage: { type: String, required: false },
    variants: { type: [videoVariantSchema], default: [] },
    analysisSummary: { type: String, required: false },
  },
  { timestamps: true },
);

videoSchema.index({ ownerUserId: 1, createdAt: -1 });

export const VideoModel = mongoose.model<VideoDocument>("Video", videoSchema);
