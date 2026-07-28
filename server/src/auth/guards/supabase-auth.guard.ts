import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { AuthService } from "../auth.service.js";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator.js";

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly issuer: string;
  private readonly audience: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
    config: ConfigService,
  ) {
    const supabaseUrl = config.getOrThrow<string>("SUPABASE_URL").replace(/\/$/, "");
    this.issuer = `${supabaseUrl}/auth/v1`;
    this.audience = config.get<string>("SUPABASE_JWT_AUDIENCE", "authenticated");
    this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`));
  }

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization as string | undefined;
    const [scheme, token] = authorization?.split(" ") ?? [];
    if (scheme !== "Bearer" || !token) {
      throw new UnauthorizedException("A Bearer access token is required.");
    }

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
      });
      request.user = await this.authService.resolveUser(payload);
      return true;
    } catch {
      throw new UnauthorizedException("The access token is invalid or expired.");
    }
  }
}
