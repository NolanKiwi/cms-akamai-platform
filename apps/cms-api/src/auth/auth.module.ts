import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User } from './entities/user.entity';
import { UserSiteRole } from './entities/user-site-role.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserSiteRole]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const keyPath = config.get<string>('JWT_PRIVATE_KEY_PATH', './keys/jwt-private.pem');
        const pubPath = config.get<string>('JWT_PUBLIC_KEY_PATH', './keys/jwt-public.pem');
        try {
          return {
            privateKey: readFileSync(keyPath),
            publicKey: readFileSync(pubPath),
            signOptions: {
              algorithm: 'RS256',
              expiresIn: config.get('JWT_EXPIRES_IN', '8h'),
              issuer: 'cms-akamai-platform',
            },
          };
        } catch {
          // 개발 환경에서 키 파일 없으면 HS256 fallback
          const secret = config.get('SESSION_SECRET', 'dev-secret-please-change');
          return { secret, signOptions: { expiresIn: '8h' } };
        }
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
