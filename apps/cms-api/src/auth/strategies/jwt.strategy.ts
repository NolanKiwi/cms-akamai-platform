import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { AuthService, JwtPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    const pubPath = config.get<string>('JWT_PUBLIC_KEY_PATH', './keys/jwt-public.pem');
    let secretOrKey: string | Buffer;
    try {
      secretOrKey = readFileSync(pubPath);
    } catch {
      secretOrKey = config.get('SESSION_SECRET', 'dev-secret-please-change');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.authService.findById(payload.sub);
    if (!user) throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
    return { ...payload, globalRole: payload.globalRole ?? (user as any).role };
  }
}
