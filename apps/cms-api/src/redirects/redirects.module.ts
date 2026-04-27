import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Redirect } from './entities/redirect.entity';
import { RedirectsService } from './redirects.service';
import { RedirectsController } from './redirects.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Redirect])],
  providers: [RedirectsService],
  controllers: [RedirectsController],
  exports: [RedirectsService],
})
export class RedirectsModule {}
