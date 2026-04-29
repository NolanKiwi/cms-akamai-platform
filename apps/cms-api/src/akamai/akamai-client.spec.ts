import { ConfigService } from '@nestjs/config';
import { AkamaiClient } from './akamai-client.service';

function makeConfig(env: Record<string, string | undefined>): ConfigService {
  return {
    get: <T = any>(key: string, def?: T) => (env[key] !== undefined ? (env[key] as any) : def),
  } as unknown as ConfigService;
}

describe('AkamaiClient', () => {
  it('runs in dry-run mode when AKAMAI_HOST is unset', () => {
    const c = new AkamaiClient(makeConfig({}));
    expect(c.isDryRun()).toBe(true);
  });

  it('runs in dry-run when host is empty whitespace', () => {
    const c = new AkamaiClient(makeConfig({ AKAMAI_HOST: '   ' }));
    expect(c.isDryRun()).toBe(true);
  });

  it('returns synthetic response in dry-run', async () => {
    const c = new AkamaiClient(makeConfig({}));
    const res: any = await c.request('GET', '/papi/v1/contracts');
    expect(res.dryRun).toBe(true);
    expect(res.method).toBe('GET');
    expect(res.path).toBe('/papi/v1/contracts');
  });

  it('switches out of dry-run when host is configured', () => {
    const c = new AkamaiClient(
      makeConfig({
        AKAMAI_HOST: 'akab-test.luna.akamaiapis.net',
        AKAMAI_CLIENT_TOKEN: 'akab-x',
        AKAMAI_CLIENT_SECRET: 'x',
        AKAMAI_ACCESS_TOKEN: 'akab-x',
      }),
    );
    expect(c.isDryRun()).toBe(false);
  });
});
