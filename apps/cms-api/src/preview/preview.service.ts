import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface PreviewToken {
  contentEntryId: string;
  siteId: string;
  versionId?: string;
  exp: number;
}

@Injectable()
export class PreviewService {
  private readonly secret: string;

  constructor(private config: ConfigService, private jwtService: JwtService) {
    this.secret = config.get('PREVIEW_SECRET', 'preview-dev-secret');
  }

  generateToken(contentEntryId: string, siteId: string, versionId?: string, ttlSeconds = 3600): string {
    return this.jwtService.sign(
      { contentEntryId, siteId, versionId },
      { secret: this.secret, expiresIn: ttlSeconds },
    );
  }

  validateToken(token: string): PreviewToken {
    try {
      return this.jwtService.verify<PreviewToken>(token, { secret: this.secret });
    } catch {
      throw new UnauthorizedException('Invalid or expired preview token');
    }
  }
}
