import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';

describe('Auth Integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(() => app.close());

  it('GET /health returns ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /auth/login with missing fields returns 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('GET /admin/content without auth returns 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/admin/content');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/ready returns ready', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/ready');
    expect(res.status).toBe(200);
  });
});
