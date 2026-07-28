import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { JWTPayload } from "jose";
import { PrismaService } from "../prisma/prisma.service.js";
import type { AuthUser } from "./auth-user.interface.js";
import { AppRole } from "./roles.enum.js";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async signInWithUsername(username: string, password: string) {
    const normalizedUsername = username.trim().toLowerCase();
    const profile = await this.prisma.userProfile.findUnique({
      where: { username: normalizedUsername },
    });
    if (!profile || profile.status !== "ACTIVE") {
      throw new UnauthorizedException("Invalid username or password.");
    }

    const supabaseUrl = this.config.getOrThrow<string>("SUPABASE_URL").replace(/\/$/, "");
    const supabaseKey = this.config.get<string>("SUPABASE_PUBLISHABLE_KEY")
      ?? this.config.get<string>("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
      ?? this.config.get<string>("SUPABASE_ANON_KEY")
      ?? this.config.get<string>("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    if (!supabaseKey) throw new UnauthorizedException("Authentication is not configured.");

    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: profile.email, password }),
    });

    if (!response.ok) throw new UnauthorizedException("Invalid username or password.");
    const session = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
    };
    return session;
  }

  async requestPasswordReset(username: string) {
    const normalizedUsername = username.trim().toLowerCase();
    const profile = await this.prisma.userProfile.findUnique({
      where: { username: normalizedUsername },
      select: { id: true, status: true },
    });
    if (profile?.status === "ACTIVE") {
      await this.prisma.auditLog.create({
        data: {
          userId: profile.id,
          action: "PASSWORD_RESET_REQUESTED",
          entityType: "USER",
          entityId: profile.id,
        },
      });
    }
    return {
      message: "If the username is active, the administrator has received the password reset request.",
    };
  }

  async resolveUser(payload: JWTPayload): Promise<AuthUser> {
    if (!payload.sub) throw new ForbiddenException("Token subject is missing.");
    const profile = await this.prisma.userProfile.findUnique({
      where: { authUserId: payload.sub },
      include: { role: true },
    });
    if (!profile) throw new ForbiddenException("No inventory profile is linked to this account.");
    if (profile.status !== "ACTIVE") throw new ForbiddenException("This account is disabled.");
    return {
      id: profile.id,
      authUserId: profile.authUserId,
      username: profile.username,
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl,
      role: profile.role.code as AppRole,
    };
  }

  async recordLogin(user: AuthUser, ipAddress?: string, userAgent?: string) {
    await this.prisma.$transaction([
      this.prisma.userProfile.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "AUTH_SESSION_VERIFIED",
          entityType: "USER",
          entityId: user.id,
          ipAddress,
          userAgent,
        },
      }),
    ]);
    return user;
  }
}
