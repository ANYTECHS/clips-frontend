import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { API_SCOPES } from '../api-key.constants';

export class CreateApiKeyDto {
  @ApiProperty({
    description: 'Human-readable label for the key',
    example: 'CI pipeline',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Scopes granted to the key',
    type: [String],
    enum: API_SCOPES,
    isArray: true,
    example: ['clips:read', 'clips:write'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(API_SCOPES.length)
  @IsString({ each: true })
  scopes!: string[];

  @ApiPropertyOptional({
    description: 'Optional expiry timestamp (ISO 8601). Omit for no expiry.',
    example: '2027-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
