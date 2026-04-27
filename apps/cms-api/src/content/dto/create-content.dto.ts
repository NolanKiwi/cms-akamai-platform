import { IsString, IsOptional, IsObject, IsUUID, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateContentDto {
  @ApiProperty() @IsUUID() siteId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() locale?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiProperty() @IsObject() fields: Record<string, any>;
  @ApiPropertyOptional() @IsOptional() @IsObject() meta?: Record<string, any>;
}
