import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const ffmpegPath = require("ffmpeg-static") as string | null;
const ffprobePath = (require("ffprobe-static") as { path: string }).path;

export type FfprobeFormat = {
  duration?: string;
  size?: string;
};

export type FfprobeStream = {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
};

export type FfprobeJson = {
  streams?: FfprobeStream[];
  format?: FfprobeFormat;
};

const assertBinaries = (): { ffmpeg: string; ffprobe: string } => {
  if (!ffmpegPath) {
    throw new Error("ffmpeg-static binary not found for this platform");
  }
  return { ffmpeg: ffmpegPath, ffprobe: ffprobePath };
};

export const ffprobeVideo = async (inputPath: string): Promise<FfprobeJson> => {
  const { ffprobe } = assertBinaries();
  const { stdout } = await execFileAsync(
    ffprobe,
    [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      inputPath,
    ],
    { maxBuffer: 20 * 1024 * 1024 },
  );
  return JSON.parse(stdout) as FfprobeJson;
};

const runFfmpegToNull = async (args: string[]): Promise<string> => {
  const { ffmpeg } = assertBinaries();
  try {
    const { stderr } = await execFileAsync(ffmpeg, args, {
      maxBuffer: 50 * 1024 * 1024,
    });
    return stderr;
  } catch (err: unknown) {
    const maybe = err as { stderr?: string };
    if (typeof maybe.stderr === "string") return maybe.stderr;
    throw err;
  }
};

/**
 * Parses ffmpeg blackdetect filter stderr; returns approximate ratio of black frames vs duration.
 */
export const estimateBlackContentRatio = async (
  inputPath: string,
  durationSec: number,
): Promise<number> => {
  if (durationSec <= 0) return 1;
  const stderr = await runFfmpegToNull([
    "-hide_banner",
    "-i",
    inputPath,
    "-vf",
    "blackdetect=d=0.1:pix_th=0.98",
    "-an",
    "-f",
    "null",
    "-",
  ]);

  let blackDur = 0;
  const lines = stderr.split(/\r?\n/);
  for (const line of lines) {
    if (!line.includes("blackdetect") || !line.includes("black_start")) continue;
    const start = line.match(/black_start:([0-9.]+)/);
    const end = line.match(/black_end:([0-9.]+)/);
    if (start?.[1] && end?.[1]) {
      blackDur += Math.max(0, Number(end[1]) - Number(start[1]));
    }
  }

  return Math.min(1, blackDur / durationSec);
};

export type TranscodeQuality = "240" | "480" | "720";

const HEIGHT: Record<TranscodeQuality, number> = {
  "240": 240,
  "480": 480,
  "720": 720,
};

export const transcodeToQuality = async (
  inputPath: string,
  outputPath: string,
  quality: TranscodeQuality,
): Promise<void> => {
  const { ffmpeg } = assertBinaries();
  const h = HEIGHT[quality];
  await execFileAsync(
    ffmpeg,
    [
      "-hide_banner",
      "-y",
      "-i",
      inputPath,
      "-vf",
      `scale=-2:${h}`,
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    { maxBuffer: 50 * 1024 * 1024 },
  );
};

export const getVideoStream = (probe: FfprobeJson): FfprobeStream | undefined => {
  return probe.streams?.find((s) => s.codec_type === "video");
};

export const getDurationSec = (probe: FfprobeJson): number => {
  const d = probe.format?.duration;
  if (!d) return 0;
  const n = Number(d);
  return Number.isFinite(n) ? n : 0;
};
