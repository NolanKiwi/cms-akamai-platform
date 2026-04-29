import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { AkamaiClient } from './akamai-client.service';
import { PapiService } from './papi.service';
import { ReportingService } from './reporting.service';
import { EdgeWorkersService } from './edgeworkers.service';
import { EdgeDnsService } from './edge-dns.service';
import { CpCodeService } from './cpcode.service';

@ApiTags('Akamai (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/akamai')
export class AkamaiController {
  constructor(
    private readonly client: AkamaiClient,
    private readonly papi: PapiService,
    private readonly reporting: ReportingService,
    private readonly ew: EdgeWorkersService,
    private readonly dns: EdgeDnsService,
    private readonly cpcode: CpCodeService,
  ) {}

  @Get('status')
  @Roles(UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Akamai 자격증명 dryRun 여부' })
  status() {
    return { dryRun: this.client.isDryRun() };
  }

  @Post('proxy')
  @Roles(UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Generic Akamai OPEN API passthrough (EdgeGrid signed)',
    description:
      'Body: { method, path, body? }. `path` must start with "/" (e.g. "/papi/v1/contracts"). Proxies through the configured EdgeGrid credentials and returns the raw status, headers, and data. Restricted to DEVELOPER/ADMIN.',
  })
  async proxy(
    @Body() body: { method?: string; path?: string; body?: any },
  ) {
    const method = String(body?.method || 'GET').toUpperCase();
    const path = String(body?.path || '').trim();
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      throw new BadRequestException(`Unsupported method: ${method}`);
    }
    if (!path.startsWith('/')) {
      throw new BadRequestException('path must start with "/"');
    }
    return this.client.requestRaw(method as any, path, body?.body);
  }

  @Get('papi/groups')
  @Roles(UserRole.DEVELOPER, UserRole.ADMIN)
  papiGroups() {
    return this.papi.listGroups();
  }

  @Get('papi/contracts')
  @Roles(UserRole.DEVELOPER, UserRole.ADMIN)
  papiContracts() {
    return this.papi.listContracts();
  }

  @Get('papi/properties')
  @Roles(UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiQuery({ name: 'contractId', required: true })
  @ApiQuery({ name: 'groupId', required: true })
  papiProperties(@Query('contractId') c: string, @Query('groupId') g: string) {
    return this.papi.listProperties(c, g);
  }

  @Get('papi/search')
  @Roles(UserRole.VIEWER, UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: 'PAPI find-by-value (propertyName / hostname / edgeHostname)' })
  @ApiQuery({ name: 'propertyName', required: false })
  @ApiQuery({ name: 'hostname', required: false })
  @ApiQuery({ name: 'edgeHostname', required: false })
  papiSearch(
    @Query('propertyName') propertyName?: string,
    @Query('hostname') hostname?: string,
    @Query('edgeHostname') edgeHostname?: string,
  ) {
    const q: any = {};
    if (propertyName) q.propertyName = propertyName;
    if (hostname) q.hostname = hostname;
    if (edgeHostname) q.edgeHostname = edgeHostname;
    return this.papi.searchByValue(q);
  }

  @Get('papi/properties-by-creator')
  @Roles(UserRole.VIEWER, UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: '계정 전 그룹을 스캔해 첫 버전을 만든 사용자가 일치하는 property 추출' })
  @ApiQuery({ name: 'user', required: true, example: 'gdimitri' })
  @ApiQuery({ name: 'force', required: false })
  @ApiQuery({ name: 'maxGroups', required: false })
  @ApiQuery({ name: 'maxProperties', required: false })
  async papiByCreator(
    @Query('user') user: string,
    @Query('force') force?: string,
    @Query('maxGroups') maxGroups?: string,
    @Query('maxProperties') maxProperties?: string,
  ) {
    return this.papi.startCreatorScan(user, {
      force: force === 'true',
      maxGroups: maxGroups ? +maxGroups : undefined,
      maxProperties: maxProperties ? +maxProperties : undefined,
    });
  }

  @Get('reporting/v2/reports')
  @Roles(UserRole.VIEWER, UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Reporting v2 — list available reports' })
  reportingListV2() {
    return this.reporting.listV2Reports();
  }

  @Get('reporting/v1/reports')
  @Roles(UserRole.VIEWER, UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Reporting v1 — list named reports' })
  reportingListV1() {
    return this.reporting.listV1Reports();
  }

  @Get('edgeworkers')
  @Roles(UserRole.DEVELOPER, UserRole.ADMIN)
  ewList() {
    return this.ew.listIds();
  }

  @Post('edgeworkers/:id/activate')
  @Roles(UserRole.ADMIN)
  ewActivate(
    @Param('id') id: string,
    @Body() body: { version: string; network: 'STAGING' | 'PRODUCTION'; note?: string },
  ) {
    return this.ew.activate(+id, body.version, body.network, body.note);
  }

  @Get('dns/zones')
  @Roles(UserRole.DEVELOPER, UserRole.ADMIN)
  dnsZones() {
    return this.dns.listZones();
  }

  @Get('cpcodes')
  @Roles(UserRole.VIEWER, UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: 'CP Code 목록 (CPRG API)' })
  cpcodeList() {
    return this.cpcode.list();
  }

  @Get('cpcodes/:id')
  @Roles(UserRole.VIEWER, UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: 'CP Code 상세 조회' })
  cpcodeOne(@Param('id') id: string) {
    return this.cpcode.get(id);
  }

  @Get('cpcodes/:id/traffic')
  @Roles(UserRole.VIEWER, UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiQuery({ name: 'hours', required: false, example: 24 })
  @ApiQuery({ name: 'interval', required: false, example: 'HOUR' })
  @ApiOperation({ summary: 'CP Code 트래픽 (Reporting v2, 기본 24h)' })
  cpcodeTraffic(
    @Param('id') id: string,
    @Query('hours') hours?: string,
    @Query('interval') interval?: string,
  ) {
    return this.cpcode.traffic(id, {
      hours: hours ? +hours : undefined,
      interval: interval as 'FIVE_MINUTES' | 'HOUR' | 'DAY' | 'MONTH' | undefined,
    });
  }

  @Get('reporting-groups')
  @Roles(UserRole.VIEWER, UserRole.DEVELOPER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Reporting Groups (CPRG API)' })
  reportingGroups() {
    return this.cpcode.listReportingGroups();
  }
}
