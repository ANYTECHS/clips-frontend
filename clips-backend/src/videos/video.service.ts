import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CircuitBreakerService } from '../common/circuit-breaker/circuit-breaker.service';
import { ServiceUnavailableException } from '../common/exceptions/service-unavailable.exception';
import {
  ViralMoment,
  validateAndFetchVideo,
  extractVideoMetadata,
  updateVideoProcessingStats,
  detectMomentsWithClaude,
  normalizeMoments,
  fallbackFixedChunks,
  computeAverageClipDuration,
} from './helpers';

/**
 * Circuit breaker guarding calls to the Anthropic backend.
 * Opens when the failure ratio over the sampling window exceeds the
 * threshold, stays open for `recoveryTimeout`, then allows a half-open
 * probe that auto-closes the circuit on success.
 *
 * Issue #1399
 */
const AI_BACKEND_BREAKER = {
  name: 'anthropic-ai',
  failureThreshold: 50,
  recoveryTimeout: 30_000,
  samplingDuration: 60_000,
} as const;

/**
 * Orchestrates viral-moment detection for a video.
 * Validation, metadata, AI detection, stats updates, and moment math live in helpers.
 */
@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  async detectViralTimestamps(videoId: number): Promise<ViralMoment[]> {
    const startTime = Date.now();
    let durationSec = 0;
    let inputQuality = 'unknown';
    let momentsFound = 0;
    let clipsGenerated = 0;

    try {
      const video = await validateAndFetchVideo(this.prisma, videoId);
      const metadata = await extractVideoMetadata(video, this.logger);
      durationSec = metadata.durationSec;
      inputQuality = metadata.inputQuality;

      const { moments, provider, usage } = await this.runAiDetection(video.sourceUrl, durationSec);
      momentsFound = moments.length;

      const normalized = normalizeMoments(moments, durationSec);
      clipsGenerated = normalized.length;

      await this.saveSuccessStats(videoId, {
        startTime,
        durationSec,
        inputQuality,
        momentsFound,
        clipsGenerated,
        moments: normalized,
        provider,
        usage,
      });

      return normalized;
    } catch (e: any) {
      await this.saveErrorStats(videoId, {
        startTime,
        durationSec,
        inputQuality,
        momentsFound,
        clipsGenerated,
        error: String(e?.message ?? e),
      });
      throw e;
    }
  }

  private async runAiDetection(sourceUrl: string, durationSec: number) {
    let aiResult;
    try {
      aiResult = await this.circuitBreaker.execute(
        AI_BACKEND_BREAKER,
        async () => {
          const result = await detectMomentsWithClaude(this.config, sourceUrl);
          // The helper reports backend failures via `error` instead of throwing;
          // rethrow so the breaker records them as failures.
          if (result.error) {
            throw new Error(`AI detection failed: ${result.error}`);
          }
          return result;
        },
      );
    } catch (error) {
      // Circuit open: propagate so the caller can retry later instead of
      // silently degrading to fixed chunks while the backend is down.
      if (error instanceof ServiceUnavailableException) {
        this.logger.warn(
          `AI backend circuit open — deferring detection for retry`,
        );
        throw error;
      }
      // Single AI failure with the circuit still closed: keep the existing
      // fallback-to-fixed-chunks behaviour.
      this.logger.warn(
        `AI detection failed, falling back to fixed chunks: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return {
        moments: fallbackFixedChunks(durationSec),
        provider: 'fallback-fixed-chunks',
        usage: undefined,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    let moments: ViralMoment[] | null = aiResult.moments;
    let provider = aiResult.provider;

    if (!moments) {
      moments = fallbackFixedChunks(durationSec);
      provider = 'fallback-fixed-chunks';
    }

    return { moments, provider, usage: aiResult.usage, error: aiResult.error };
  }

  private async saveSuccessStats(
    videoId: number,
    stats: {
      startTime: number;
      durationSec: number;
      inputQuality: string;
      momentsFound: number;
      clipsGenerated: number;
      moments: ViralMoment[];
      provider: string;
      usage?: { inputTokens?: number; outputTokens?: number };
    },
  ) {
    const timeTakenMs = Date.now() - stats.startTime;
    const avgDurationSec = computeAverageClipDuration(stats.moments);

    await updateVideoProcessingStats(this.prisma, videoId, {
      momentsFound: stats.momentsFound,
      inputQuality: stats.inputQuality,
      durationSec: stats.durationSec,
      clipsGenerated: stats.clipsGenerated,
      timeTakenMs,
      avgDurationSec,
      moments: stats.moments,
    });

    this.logUsage(videoId, stats.provider, stats.usage);
  }

  private async saveErrorStats(
    videoId: number,
    stats: {
      startTime: number;
      durationSec: number;
      inputQuality: string;
      momentsFound: number;
      clipsGenerated: number;
      error: string;
    },
  ) {
    const timeTakenMs = Date.now() - stats.startTime;

    try {
      await updateVideoProcessingStats(this.prisma, videoId, {
        momentsFound: stats.momentsFound,
        inputQuality: stats.inputQuality,
        durationSec: stats.durationSec,
        clipsGenerated: stats.clipsGenerated,
        timeTakenMs,
        error: stats.error,
      });
    } catch (updateError) {
      this.logger.error(
        `Failed to update processingStats on error: ${updateError}`,
      );
    }
  }

  private logUsage(
    videoId: number,
    provider: string,
    usage?: { inputTokens?: number; outputTokens?: number },
  ) {
    const model = this.config.get<string>('ANTHROPIC_MODEL') || 'claude-4.1';

    if (usage?.inputTokens || usage?.outputTokens) {
      this.logger.log(
        `ai_usage videoId=${videoId} provider=${provider} model=${model} input_tokens=${usage?.inputTokens ?? 0} output_tokens=${usage?.outputTokens ?? 0}`,
      );
    } else {
      this.logger.log(
        `ai_usage videoId=${videoId} provider=${provider} model=${model}`,
      );
    }
  }
}
