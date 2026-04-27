import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PreviewService } from './preview.service';
import { PreviewController } from './preview.controller';

@Module({
  imports: [JwtModule.register({})],
  providers: [PreviewService],
  controllers: [PreviewController],
  exports: [PreviewService],
})
export class PreviewModule {}
