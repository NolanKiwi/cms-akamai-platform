import { IsOptional, IsObject, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateContentDto {
  @ApiPropertyOptional() @IsOptional() @IsObject() fields?: Record<string, any>;
  @ApiPropertyOptional() @IsOptional() @IsObject() meta?: Record<string, any>;
  @ApiPropertyOptional() @IsOptional() @IsString() changeNote?: string;
}
