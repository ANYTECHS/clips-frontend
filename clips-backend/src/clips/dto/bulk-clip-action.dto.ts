import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIdArray } from '../../common/validators/array-validators';

export const BULK_CLIP_ACTIONS = ['delete', 'mint'] as const;
export type BulkClipAction = (typeof BULK_CLIP_ACTIONS)[number];

/** Maximum clips accepted per bulk request (Issue #1401). */
export const BULK_CLIP_ACTION_MAX_ITEMS = 50;

/**
 * POST /clips/bulk — apply one action to up to 50 clips.
 *
 * `creatorWallet` is required when `action` is `mint` (all NFTs are minted
 * to the same Stellar wallet) and ignored for `delete`.
 */
export class BulkClipActionDto {
  @ApiProperty({
    description: 'Bulk action to apply to every clip in clipIds',
    enum: BULK_CLIP_ACTIONS,
    example: 'delete',
  })
  @IsIn(BULK_CLIP_ACTIONS, {
    message: `action must be one of: ${BULK_CLIP_ACTIONS.join(', ')}`,
  })
  action!: BulkClipAction;

  @ApiProperty({
    description: `IDs of the clips to act on (1–${BULK_CLIP_ACTION_MAX_ITEMS})`,
    type: [Number],
    example: [1, 2, 3],
  })
  @IsIdArray({
    min: 1,
    max: BULK_CLIP_ACTION_MAX_ITEMS,
    description: `Clip IDs to process — at most ${BULK_CLIP_ACTION_MAX_ITEMS} per request`,
    example: [1, 2, 3],
  })
  clipIds!: number[];

  @ApiPropertyOptional({
    description:
      'Stellar wallet address that receives the minted NFTs. Required when action=mint.',
    example: 'GC6XOTK6L6LGBKIWH3IRUZPVUY4COGEMW4J5YINOSPKO27YKTUUHTZF3',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'creatorWallet must not be empty' })
  creatorWallet?: string;
}
