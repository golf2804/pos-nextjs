import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthUser } from "../auth-user.interface.js";
import { ROLES_KEY } from "../decorators/roles.decorator.js";
import { AppRole } from "../roles.enum.js";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;
    const user = context.switchToHttp().getRequest().user as AuthUser | undefined;
    return Boolean(user && (user.role === AppRole.ADMIN || roles.includes(user.role)));
  }
}
