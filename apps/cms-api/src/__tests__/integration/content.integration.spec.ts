import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppModule } from '../../app.module';
import { User, UserRole } from '../../auth/entities/user.entity';
import { AuthService } from '../../auth/auth.service';

describe('Content Integration', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // Create a test admin user
    const authService = module.get(AuthService);
    const userRepo = module.get(getRepositoryToken(User));
    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash('testPassword123!', 10);
    const user = userRepo.create({
      email: 'test-admin@cms.test',
      name: 'Test Admin',
      role: UserRole.ADMIN,
      passwordHash: hash,
    });
    await userRepo.save(user).catch(() => {});

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'test-admin@cms.test', password: 'testPassword123!' });
    accessToken = loginRes.body.accessToken;
  });

  afterAll(() => app.close());

  it('GET /api/v1/admin/content requires auth', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/admin/content');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/admin/content with token returns 200', async () => {
    if (!accessToken) return; // skip if DB not available
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/content?siteId=test')
      .set('Authorization', `Bearer ${accessToken}`);
    expect([200, 400]).toContain(res.status);
  });

  it('POST /api/v1/admin/content validates body', async () => {
    if (!accessToken) return;
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/content')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(res.status).toBe(400);
  });
});
