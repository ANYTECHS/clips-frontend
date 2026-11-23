/**
 * ClipsController — HTTP endpoints for clip management.
 *
 * Issue #850: Uses the reusable @Auth() decorator at the class level so every
 *             endpoint is automatically protected by JwtAuthGuard and
 *             documented with @ApiBearerAuth() — no per-method duplication.
 *
 * Issue #866: List endpoint delegates to ClipsService.listClips() which uses
 *             selective `select` (no broad `include`) to prevent N+1 patterns.
 */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ParsePositiveIntPipe } from '../common/pipes';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { Auth } from '../auth/decorators/auth.decorator';
import { RequireScope } from '../auth/api-keys/decorators/require-scope.decorator';
import { assertApiKeyScope } from '../auth/api-keys/api-key-scope.util';
import {
  QueueRateLimitGuard,
  QueueRateLimit,
} from '../common/guards/queue-rate-limit.guard';
import { ClipsService } from './clips.service';
import { BulkClipActionService } from './bulk-clip-action.service';
import type { ClipSortField, SortOrder } from './clips.service';
import { ClipPublishService } from './clip-publish.service';
import { ClipResponseDto } from './dto/clip-response.dto';
import type { BulkUpdateClipsDto } from './dto/bulk-update-clips.dto';
import { BulkDeleteClipsDto } from './dto/bulk-delete-clips.dto';
import {
  BulkClipActionDto,
  BULK_CLIP_ACTION_MAX_ITEMS,
} from './dto/bulk-clip-action.dto';
import { UpdateClipRoyaltyDto } from './dto/update-clip-royalty.dto';
import { GenerateClipsDto } from './dto/generate-clips.dto';
import { UpdateClipDto } from './dto/update-clip.dto';
import {
  SetRoyaltyBpsDto,
  SetRoyaltyBpsResponseDto,
} from './dto/set-royalty-bps.dto';
import { DEFAULT_CLIP_ROYALTY_BPS } from './dto/create-clip.dto';

/**
 * All clip endpoints require a valid JWT.
 * Protected via the @Auth() composite decorator (issue #850).
 */
@ApiTags('Clips')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Unauthorized — JWT token required' })
@ApiInternalServerErrorResponse({ description: 'Internal server error' })
@Auth()
@Controller('clips')
export class ClipsController {
  constructor(
    private readonly clipsService: ClipsService,
    private readonly clipPublishService: ClipPublishService,
    private readonly bulkClipActionService: BulkClipActionService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Generate
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * POST /clips/generate
   *
   * Enqueue a clip-generation job for a video.
   * Rate-limited to 5 active jobs per user.
   */
  @Post('generate')
  @RequireScope('clips:write')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(QueueRateLimitGuard)
  @QueueRateLimit({ queue: 'clip-generation', maxJobs: 5 })
  @ApiOperation({
    summary: 'Generate clips from a video',
    description:
      'Enqueues a clip-generation job with automatic retry + exponential backoff. ' +
      'Returns the BullMQ job ID immediately; processing happens asynchronously.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Clip generation job queued successfully. Processing is asynchronous; ' +
      'the returned jobId identifies the BullMQ job and does not mean clips are ready.',
    schema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', example: 'clip-generation-123' },
        status: { type: 'string', example: 'queued' },
      },
    },
    status: 202,
    description: 'Clip generation job accepted and queued for processing',
    schema: {
      example: { jobId: 'clip-job-123', delayed: false, delayMs: 0 },
    },
  })
  @ApiBody({ type: GenerateClipsDto })
  @ApiResponse({
    status: 400,
    description:
      'Invalid settings: duration out of range (5–180s) or max < min, unsupported style/language, clipCount outside 1–20',
  })
  @ApiResponse({ status: 429, description: 'Too many active jobs (max 5)' })
  generate(@Body() dto: GenerateClipsDto) {
    return this.clipsService.enqueueClip(dto);
  }

  /**
   * GET /clips/generate/:jobId/status
   *
   * Returns the current BullMQ state and progress for an asynchronous job.
   */
  @Get('generate/:jobId/status')
  @RequireScope('clips:read')
  @ApiOperation({
    summary: 'Get clip-generation job status',
    description:
      'Returns BullMQ state, retry count, progress, result, and failure details for a clip-generation job.',
  })
  @ApiParam({
    name: 'jobId',
    description: 'BullMQ job ID returned by POST /clips/generate',
    type: String,
  })
  @ApiOkResponse({ description: 'Current asynchronous clip-generation job status' })
  @ApiNotFoundResponse({ description: 'Clip-generation job not found' })
  getGenerationStatus(@Param('jobId') jobId: string) {
    return this.clipsService.getClipGenerationStatus(jobId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // List & Fetch
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * GET /clips
   *
   * Issue #866: list endpoint uses selective `select` in the service layer
   * (no broad `include`) — prevents N+1 and oversized payloads.
   * Documented trade-off: full relations (video, clipPosts, earnings) are
   * only available on GET /clips/:id.
   */
  @Get()
  @RequireScope('clips:read')
  @ApiOperation({
    summary: 'List clips (paginated)',
    description:
      'Returns a paginated list of clips. Uses selective field loading — ' +
      'full relations (video, clipPosts, earnings) are only available on ' +
      'GET /clips/:id. Sort by viralityScore to surface the best clips first.',
  })
  @ApiOkResponse({
    description: 'Paginated list of clips returned successfully',
    type: ClipResponseDto,
    isArray: true,
  })
  @ApiQuery({ name: 'videoId', required: false, description: 'Filter to a specific source video' })
  @ApiQuery({
    name: 'sort',
    required: false,
    description: 'Combined sort: field:order (e.g. viralityScore:desc, createdAt:asc)',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: 'Sort field: viralityScore | createdAt | duration',
  })
  @ApiQuery({ name: 'order', required: false, description: 'asc | desc' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based, default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page (1–100, default: 20)' })
  list(
    @Query('videoId') videoId?: string,
    @Query('sort') sort?: string,
    @Query('sortBy') sortBy?: ClipSortField,
    @Query('order') order?: SortOrder,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedPage = page !== undefined ? parseInt(page, 10) : 1;
    const parsedLimit = limit !== undefined ? parseInt(limit, 10) : 20;

    if (isNaN(parsedPage) || isNaN(parsedLimit)) {
      throw new BadRequestException('page and limit must be integers');
    }

    let finalSortBy = sortBy;
    let finalOrder = order;

    // Combined sort format: "field:order"
    if (sort) {
      const [field, dir] = sort.split(':');
      if (field) finalSortBy = field as ClipSortField;
      if (dir) finalOrder = dir as SortOrder;
    }

    return this.clipsService.listClips({
      videoId,
      sortBy: finalSortBy,
      order: finalOrder,
      page: parsedPage,
      limit: parsedLimit,
    });
  }

  /**
   * GET /clips/:id
   */
  @Get(':id')
  @RequireScope('clips:read')
  @ApiOperation({ summary: 'Get a single clip by ID' })
  @ApiParam({ name: 'id', description: 'Positive integer clip ID', type: Number, example: 42 })
  @ApiOkResponse({ description: 'Clip found', type: ClipResponseDto })
  @ApiNotFoundResponse({ description: 'Clip not found' })
  @ApiBadRequestResponse({ description: 'Invalid clip ID — must be a positive integer' })
  async findOne(@Param('id', ParsePositiveIntPipe) id: number) {
    const clip = await this.clipsService.findById(id);
    if (!clip) throw new NotFoundException(`Clip ${id} not found`);
    return clip;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Bulk operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * POST /clips/bulk-update
   *
   * Update selected, postStatus, caption, or royaltyBps for multiple clips
   * in a single transaction.
   */
  @Post('bulk-update')
  @RequireScope('clips:write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk update clips',
    description:
      'Bulk update selected and/or postStatus for multiple clips in one transaction. ' +
      'Returns update statistics including notFoundIds for invalid clip IDs.',
  })
  @ApiResponse({ status: 200, description: 'Clips updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  bulkUpdate(@Body() dto: BulkUpdateClipsDto, @Req() req: Request) {
    const userId: number = Number(
      (req as any).user?.id ?? (req.headers['x-user-id'] as string) ?? 0,
    );
    return this.clipsService.bulkUpdate(userId, dto);
  }

  /**
   * POST /clips/bulk-delete
   *
   * Permanently deletes the specified clips (and their Cloudinary assets)
   * after verifying ownership. Clips not owned by the caller are skipped.
   *
   * Closes #739
   */
  @Post('bulk-delete')
  @RequireScope('clips:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk delete rejected/unwanted clips',
    description:
      'Permanently deletes the specified clips (and their Cloudinary assets) ' +
      'after verifying ownership. Clips not owned by the caller are silently skipped.',
  })
  @ApiResponse({
    status: 200,
    description: 'Deletion summary',
    schema: { example: { deleted: 3, skipped: 0, skippedIds: [] } },
  })
  @ApiBadRequestResponse({ description: 'Invalid request body' })
  @ApiForbiddenResponse({ description: 'None of the clips belong to the user' })
  bulkDelete(@Body() dto: BulkDeleteClipsDto, @Req() req: Request) {
    const userId: number = Number(
      (req as any).user?.id ?? (req.headers['x-user-id'] as string) ?? 0,
    );
    return this.clipsService.bulkDeleteRejected(userId, dto.clipIds);
  }

  /**
   * POST /clips/bulk
   *
   * Apply a single action (`delete` or `mint`) to up to 50 clips.
   * Returns a per-item result for every clipId — one failure never fails
   * the whole batch. For `mint`, `creatorWallet` is required and every
   * successful item returns its BullMQ `jobId` for status tracking via
   * GET /nfts/mint-status/:jobId.
   *
   * Issue #1401
   */
  @Post('bulk')
  @RequireScope('clips:write')
  @UseGuards(QueueRateLimitGuard)
  @QueueRateLimit({ queue: 'nft-mint', maxJobs: 5 })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk delete or mint clips',
    description:
      `Apply "delete" or "mint" to 1–${BULK_CLIP_ACTION_MAX_ITEMS} clips in one request. ` +
      'Each clip is processed independently and the response contains a per-item ' +
      'result (success | failed | skipped). Minted items return a jobId for tracking. ' +
      'creatorWallet (Stellar address) is required when action is "mint".',
  })
  @ApiBody({ type: BulkClipActionDto })
  @ApiResponse({
    status: 200,
    description: 'Per-item results for the bulk action',
    schema: {
      example: {
        action: 'delete',
        results: [
          { clipId: 1, status: 'success' },
          { clipId: 2, status: 'skipped', reason: 'not_found_or_not_owned' },
        ],
        summary: { total: 2, succeeded: 1, failed: 0, skipped: 1 },
      },
    },
  })
  @ApiBadRequestResponse({
    description: `Invalid body, unknown action, or more than ${BULK_CLIP_ACTION_MAX_ITEMS} clipIds`,
  })
  @ApiTooManyRequestsResponse({
    description: 'Too many active jobs, or wallet mint cooldown is active',
  })
  bulkAction(@Body() dto: BulkClipActionDto, @Req() req: Request) {
    // Minting is more privileged than generic clip writes — API-key callers
    // need clips:mint in addition to the route's clips:write scope.
    if (dto.action === 'mint') {
      assertApiKeyScope(req, 'clips:mint');
    }
    const userId: number = Number(
      (req as any).user?.id ?? (req.headers['x-user-id'] as string) ?? 0,
    );
    return this.bulkClipActionService.execute(userId, dto);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Per-clip mutations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * POST /clips/:id/regenerate
   *
   * Re-cuts a single clip using its original start/end timestamps and
   * uploads a fresh version to Cloudinary. Preserves viralityScore and title.
   *
   * Closes #734
   */
  @Post(':id/regenerate')
  @RequireScope('clips:write')
  @UseGuards(QueueRateLimitGuard)
  @QueueRateLimit({ queue: 'clip-generation', maxJobs: 5 })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Regenerate a clip',
    description:
      'Re-runs FFmpeg with the original timestamps, uploads a new version to ' +
      'Cloudinary and updates clipUrl + thumbnail. viralityScore and title are preserved.',
  })
  @ApiParam({ name: 'id', description: 'Positive integer clip ID', type: Number, example: 42 })
  @ApiResponse({ status: 200, description: 'Updated clip record with new clipUrl and thumbnail' })
  @ApiNotFoundResponse({ description: 'Clip not found' })
  @ApiForbiddenResponse({ description: 'Clip does not belong to the requesting user' })
  @ApiResponse({ status: 429, description: 'Too many active jobs' })
  regenerate(@Param('id', ParsePositiveIntPipe) id: number, @Req() req: Request) {
    const userId: number = Number(
      (req as any).user?.id ?? (req.headers['x-user-id'] as string) ?? 0,
    );
    return this.clipsService.regenerate(userId, id);
  }

  /**
   * PATCH /clips/:id
   *
   * Issue #1361 — update user-editable clip fields. Protected fields are rejected (400).
   */
  @Patch(':id')
  @RequireScope('clips:write')
  @ApiOperation({
    summary: 'Update clip details',
    description:
      'Update title, description, caption, visibility and metadata. Any other property ' +
      '(e.g. id, videoId, clipUrl, mintAddress, nftStatus, royaltyBps, status) is rejected with 400.',
  })
  @ApiParam({ name: 'id', description: 'Clip ID', type: Number })
  @ApiBody({ type: UpdateClipDto })
  @ApiResponse({ status: 200, description: 'Clip updated' })
  @ApiBadRequestResponse({ description: 'Validation failed or protected field supplied' })
  @ApiNotFoundResponse({ description: 'Clip not found' })
  updateClip(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClipDto,
    @Req() req: Request,
  ) {
    const userId: number = Number(
      (req as any).user?.id ?? (req.headers['x-user-id'] as string) ?? 0,
    );
    return this.clipsService.updateClip(id, userId, dto);
  }

  /**
   * PATCH /clips/:id/caption
   *
   * Update the auto-generated caption for a clip.
   */
  @Patch(':id/caption')
  @RequireScope('clips:write')
  @ApiOperation({
    summary: 'Update clip caption',
    description:
      'Update the auto-generated caption for a clip. Useful for customizing social media posts.',
  })
  @ApiParam({ name: 'id', description: 'Positive integer clip ID', type: Number, example: 42 })
  @ApiResponse({ status: 200, description: 'Caption updated' })
  @ApiBadRequestResponse({ description: 'caption is required and must be a string' })
  @ApiNotFoundResponse({ description: 'Clip not found' })
  async updateCaption(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body('caption') caption: string,
    @Req() req: Request,
  ) {
    if (!caption || typeof caption !== 'string') {
      throw new BadRequestException('caption is required and must be a string');
    }
    const userId: number = Number(
      (req as any).user?.id ?? (req.headers['x-user-id'] as string) ?? 0,
    );
    return this.clipsService.updateCaption(id, userId, caption);
  }

  /**
   * PATCH /clips/:id/royalty
   *
   * Configure creator royalty (0–1500 BPS) for a clip before minting.
   * 100 BPS = 1%. Default: 1000 (10%) when royaltyBps is omitted.
   */
  @Patch(':id/royalty')
  @RequireScope('clips:write')
  @ApiOperation({
    summary: 'Update clip NFT royalty BPS',
    description:
      'Configure creator royalty (0–1500 BPS) for a clip before minting. ' +
      '100 BPS = 1%. Defaults to 1000 (10%) when omitted.',
  })
  @ApiParam({ name: 'id', description: 'Positive integer clip ID', type: Number, example: 42 })
  @ApiOkResponse({
    description: 'Royalty BPS updated',
    schema: { example: { id: 42, royaltyBps: 1000 } },
  })
  @ApiBadRequestResponse({ description: 'royaltyBps must be 0–1500' })
  @ApiForbiddenResponse({ description: 'Clip does not belong to the requesting user' })
  @ApiNotFoundResponse({ description: 'Clip not found' })
  async updateRoyalty(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() dto: UpdateClipRoyaltyDto,
    @Req() req: Request,
  ) {
    const userId: number = Number(
      (req as any).user?.id ?? (req.headers['x-user-id'] as string) ?? 0,
    );
    return this.clipsService.updateRoyalty(
      id,
      userId,
      dto.royaltyBps ?? DEFAULT_CLIP_ROYALTY_BPS,
    );
  }

  /**
   * PATCH /clips/:id/royalty-bps
   *
   * Issue #747: Allow creators to configure a custom royalty percentage
   * (0–15%) per clip before minting as an NFT.
   */
  @Patch(':id/royalty-bps')
  @RequireScope('clips:write')
  @ApiOperation({
    summary: 'Set clip NFT royalty BPS (Issue #747)',
    description:
      'Allow creators to configure a custom royalty percentage (0–15%) per clip before minting. ' +
      'Defaults to 1000 BPS (10%) when omitted.',
  })
  @ApiParam({ name: 'id', description: 'Positive integer clip ID', type: Number, example: 42 })
  @ApiOkResponse({
    description: 'Stored royalty in basis points',
    type: SetRoyaltyBpsResponseDto,
  })
  @ApiBadRequestResponse({ description: 'royaltyBps must be 0–1500' })
  @ApiForbiddenResponse({ description: 'Clip does not belong to the requesting user' })
  @ApiNotFoundResponse({ description: 'Clip not found' })
  async setRoyaltyBps(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetRoyaltyBpsDto,
    @Req() req: Request,
  ) {
    const userId: number = Number(
      (req as any).user?.id ?? (req.headers['x-user-id'] as string) ?? 0,
    );
    return this.clipsService.setRoyaltyBps(id, userId, dto.royaltyBps);
  }

  /**
   * GET /clips/:id/royalty-bps
   *
   * Get the current royalty BPS for a clip.
   */
  @Get(':id/royalty-bps')
  @RequireScope('clips:read')
  @ApiOperation({
    summary: 'Get clip NFT royalty BPS (Issue #747)',
    description: 'Returns the configured royalty BPS for a clip, defaulting to 1000 (10%).',
  })
  @ApiParam({ name: 'id', description: 'Positive integer clip ID', type: Number, example: 42 })
  @ApiOkResponse({
    description: 'Current royalty BPS for the clip',
    type: SetRoyaltyBpsResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Clip not found' })
  async getRoyaltyBps(@Param('id', ParseIntPipe) id: number) {
    return this.clipsService.getRoyaltyBps(id);
  }
}
