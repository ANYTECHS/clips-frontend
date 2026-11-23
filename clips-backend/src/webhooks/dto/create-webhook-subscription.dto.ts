import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Events consumers can subscribe to. '*' receives every event. */
export const WEBHOOK_EVENT_TYPES = ['earning.created', '*'] as const;

export class CreateWebhookSubscriptionDto {
  @ApiProperty({
    description: 'HTTPS endpoint that receives signed webhook deliveries',
    example: 'https://example.com/hooks/clips',
  })
  @IsUrl({ require_tld: false }, { message: 'url must be a valid URL' })
  url!: string;

  @ApiProperty({
    description: 'Events to subscribe to ("*" = all events)',
    type: [String],
    enum: WEBHOOK_EVENT_TYPES,
    isArray: true,
    example: ['earning.created'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsIn(WEBHOOK_EVENT_TYPES, { each: true })
  events!: string[];

  @ApiPropertyOptional({
    description: 'Optional label for the subscription',
    example: 'Production earnings sync',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  label?: string;
}
