import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../entities/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.ADMIN]: 5,
  [UserRole.DEVELOPER]: 4,
  [UserRole.PUBLISHER]: 3,
  [UserRole.EDITOR]: 2,
  [UserRole.VIEWER]: 1,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

    const { user, params } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('권한이 없습니다.');

    // Global role takes precedence
    const globalRole: UserRole | undefined = user.globalRole;
    if (globalRole) {
      const userLevel = ROLE_HIERARCHY[globalRole] || 0;
      const minRequired = Math.min(...requiredRoles.map(r => ROLE_HIERARCHY[r]));
      if (userLevel >= minRequired) return true;
    }

    const siteId = params?.siteId;
    const userSites: Array<{ id: string; role: UserRole }> = user.sites || [];

    // 관련 사이트 역할 확인
    const siteRole = siteId
      ? userSites.find(s => s.id === siteId)?.role
      : userSites[0]?.role;

    if (!siteRole) throw new ForbiddenException('해당 사이트 접근 권한이 없습니다.');

    const userLevel = ROLE_HIERARCHY[siteRole] || 0;
    const minRequired = Math.min(...requiredRoles.map(r => ROLE_HIERARCHY[r]));

    if (userLevel < minRequired) {
      throw new ForbiddenException(`이 작업에는 ${requiredRoles.join(' 또는 ')} 권한이 필요합니다.`);
    }
    return true;
  }
}
