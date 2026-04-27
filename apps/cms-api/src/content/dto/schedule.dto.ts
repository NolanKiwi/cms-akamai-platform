import { IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ScheduleDto {
  @ApiProperty({ example: '2026-05-01T09:00:00Z' })
  @IsDateString()
  scheduledAt: Date;
}
