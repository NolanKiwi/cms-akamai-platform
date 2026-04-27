import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Health')
@Controller()
@Public()
export class HealthController {
  @Get('health')
  health() { return { status: 'ok', timestamp: new Date().toISOString() }; }

  @Get('ready')
  ready() { return { status: 'ready', timestamp: new Date().toISOString() }; }
}
