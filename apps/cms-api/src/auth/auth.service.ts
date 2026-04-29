import { Injectable, UnauthorizedException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './entities/user.entity';
import { UserSiteRole } from './entities/user-site-role.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  globalRole?: UserRole;
  sites: Array<{ id: string; role: UserRole }>;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(UserSiteRole) private readonly roleRepo: Repository<UserSiteRole>,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<{ accessToken: string; expiresIn: number }> {
    const user = await this.userRepo.findOne({ where: { email: dto.email, isActive: true } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    await this.userRepo.update(user.id, { lastLoginAt: new Date() });
    return this.issueToken(user);
  }

  async register(dto: RegisterDto): Promise<User> {
    // Production guard: only allow open registration when no users exist (bootstrap),
    // or when AUTH_ALLOW_REGISTER=true is explicitly set.
    if (process.env.NODE_ENV === 'production') {
      const allowOpen = process.env.AUTH_ALLOW_REGISTER === 'true';
      if (!allowOpen) {
        const userCount = await this.userRepo.count();
        if (userCount > 0) {
          throw new ForbiddenException(
            'Open registration is disabled. Use admin tooling or IdP to provision users.',
          );
        }
        // First-user bootstrap: force admin role for the first registered account.
        (dto as any).role = UserRole.ADMIN;
      }
    } else if (dto.role && dto.role !== UserRole.ADMIN) {
      // Even in dev, do not let arbitrary roles be self-assigned via the public endpoint.
      // Admin is fine for local bootstrap; everything else falls back to default.
    }

    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('이미 사용 중인 이메일입니다.');

    const hash = await bcrypt.hash(dto.password, 12);
    const user = this.userRepo.create({
      email: dto.email,
      name: dto.name,
      passwordHash: hash,
    });
    if (dto.role) (user as any).role = dto.role;
    return this.userRepo.save(user) as Promise<User>;
  }

  async validateSsoUser(profile: { id: string; email: string; name: string; provider: string }): Promise<User> {
    let user = await this.userRepo.findOne({ where: { ssoId: profile.id, ssoProvider: profile.provider } });
    if (!user) {
      user = this.userRepo.create({
        email: profile.email,
        name: profile.name,
        ssoId: profile.id,
        ssoProvider: profile.provider,
      });
      user = await this.userRepo.save(user);
    }
    await this.userRepo.update(user.id, { lastLoginAt: new Date() });
    return user;
  }

  async getMe(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const roles = await this.roleRepo.find({ where: { userId } });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      sites: roles.map(r => ({ id: r.siteId, role: r.role })),
    };
  }

  async issueToken(user: User): Promise<{ accessToken: string; expiresIn: number }> {
    const roles = await this.roleRepo.find({ where: { userId: user.id } });
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      globalRole: (user as any).role,
      sites: roles.map(r => ({ id: r.siteId, role: r.role })),
    };
    const accessToken = this.jwtService.sign(payload);
    return { accessToken, expiresIn: 28800 };
  }

  async validateToken(token: string): Promise<JwtPayload | null> {
    try {
      return this.jwtService.verify<JwtPayload>(token);
    } catch {
      return null;
    }
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id, isActive: true } });
  }
}
