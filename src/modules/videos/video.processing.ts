import { setTimeout as wait } from 'node:timers/promises';
import type { Server as SocketServer } from 'socket.io';
import { VideoRepository } from './video.repository.js';
import type { Sensitivity, VideoStatus } from './video.model.js';

type ProcessingStep = {
  progress: number;
  status: VideoStatus;
  phase: 'uploaded' | 'metadataValidation' | 'sensitivityAnalysis' | 'streamReady';
};

const STEPS: ProcessingStep[] = [
  { phase: 'uploaded', progress: 10, status: 'uploaded' },
  { phase: 'metadataValidation', progress: 30, status: 'processing' },
  { phase: 'sensitivityAnalysis', progress: 80, status: 'processing' },
  { phase: 'streamReady', progress: 100, status: 'ready' },
];

export class VideoProcessingService {
  constructor(private readonly videoRepository: VideoRepository, private readonly io: SocketServer) {}

  startProcessing(videoId: string, ownerUserId: string, originalName: string): void {
    void this.runPipeline(videoId, ownerUserId, originalName);
  }

  private async runPipeline(videoId: string, ownerUserId: string, originalName: string): Promise<void> {
    try {
      for (const step of STEPS) {
        await this.videoRepository.updateProcessing(videoId, {
          status: step.status,
          progress: step.progress,
        });

        this.io.to(ownerUserId).emit('video:progress', {
          videoId,
          phase: step.phase,
          progress: step.progress,
          status: step.status,
        });

        await wait(400);
      }

      const sensitivity = this.classifySensitivity(originalName);
      const finalStatus: VideoStatus = sensitivity === 'flagged' ? 'flagged' : 'ready';

      await this.videoRepository.updateProcessing(videoId, {
        status: finalStatus,
        progress: 100,
        sensitivity,
      });

      this.io.to(ownerUserId).emit('video:status', {
        videoId,
        status: finalStatus,
        sensitivity,
      });
    } catch {
      await this.videoRepository.updateProcessing(videoId, {
        status: 'failed',
        progress: 100,
        errorMessage: 'Processing failed',
      });

      this.io.to(ownerUserId).emit('video:error', {
        videoId,
        status: 'failed',
      });
    }
  }

  private classifySensitivity(originalName: string): Sensitivity {
    const lowered = originalName.toLowerCase();
    if (lowered.includes('nsfw') || lowered.includes('sensitive') || lowered.includes('flagged')) {
      return 'flagged';
    }
    return 'safe';
  }
}
