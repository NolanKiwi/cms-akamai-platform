import { Module } from '@nestjs/common';
import { AkamaiClient } from './akamai-client.service';
import { PapiService } from './papi.service';
import { ReportingService } from './reporting.service';
import { EdgeWorkersService } from './edgeworkers.service';
import { EdgeDnsService } from './edge-dns.service';
import { CpCodeService } from './cpcode.service';
import { AkamaiController } from './akamai.controller';

@Module({
  controllers: [AkamaiController],
  providers: [AkamaiClient, PapiService, ReportingService, EdgeWorkersService, EdgeDnsService, CpCodeService],
  exports: [AkamaiClient, PapiService, ReportingService, EdgeWorkersService, EdgeDnsService, CpCodeService],
})
export class AkamaiModule {}
