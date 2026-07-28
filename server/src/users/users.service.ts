import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, RoleCode } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { AuthUser } from "../auth/auth-user.interface.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import type { CreateUserDto, UpdateUserDto } from "./dto/user.dto.js";

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async list() {
    const users = await this.prisma.userProfile.findMany({ orderBy: { fullName: "asc" }, include: { role: true } });
    const roles = await this.prisma.role.findMany({ orderBy: { id: "asc" } });
    const requests = await this.prisma.auditLog.findMany({
      where: {
        action: "PASSWORD_RESET_REQUESTED",
        userId: { in: users.map((user) => user.id) },
      },
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    const latestRequest = new Map<string, Date>();
    for (const request of requests) {
      if (request.userId && !latestRequest.has(request.userId)) {
        latestRequest.set(request.userId, request.createdAt);
      }
    }
    return {
      users: users.map((user) => this.toResponse(user, latestRequest.get(user.id))),
      roles,
    };
  }

  async create(input: CreateUserDto, actor: AuthUser) {
    const username = input.username.trim().toLowerCase();
    const existing = await this.prisma.userProfile.findUnique({ where: { username } });
    if (existing) throw new ConflictException("Username already exists.");
    const role = await this.prisma.role.findUniqueOrThrow({ where: { code: input.roleCode as RoleCode } });
    const email = `${randomUUID()}@inventory.internal`;
    const authUserId = await this.createSupabaseUser(input, email);
    const passwordUpdatedAt = new Date();
    try {
      const user = await this.prisma.userProfile.create({
        data: {
          authUserId,
          username,
          email,
          fullName: input.fullName,
          roleId: role.id,
          passwordUpdatedAt,
        },
        include: { role: true },
      });
      await this.audit(actor, "USER_CREATED", user.id, { username: user.username, role: role.code });
      await this.notifications.syncUserAlerts(user.id).catch((error) => {
        this.logger.warn(`User created, but initial stock alerts could not be generated: ${String(error)}`);
      });
      return this.toResponse(user);
    } catch (error) {
      await this.deleteSupabaseUser(authUserId).catch(() => undefined);
      this.handleKnownError(error);
      throw error;
    }
  }

  async update(id: string, input: UpdateUserDto, actor: AuthUser) {
    const existing = await this.prisma.userProfile.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("User not found.");
    const role = input.roleCode ? await this.prisma.role.findUniqueOrThrow({ where: { code: input.roleCode as RoleCode } }) : null;
    try {
      const user = await this.prisma.userProfile.update({ where: { id }, data: { username: input.username?.toLowerCase(), fullName: input.fullName, status: input.status, roleId: role?.id }, include: { role: true } });
      await this.audit(actor, "USER_UPDATED", id, { username: user.username, role: user.role.code });
      return this.toResponse(user);
    } catch (error) { this.handleKnownError(error); throw error; }
  }

  async remove(id: string, actor: AuthUser) {
    if (id === actor.id) throw new BadRequestException("You cannot delete your own user.");
    const user = await this.prisma.userProfile.update({ where: { id }, data: { status: "DISABLED" }, include: { role: true } });
    await this.audit(actor, "USER_DISABLED", id, { username: user.username });
    return this.toResponse(user);
  }

  async resetPassword(id: string, password: string, actor: AuthUser) {
    const user = await this.prisma.userProfile.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("User not found.");
    await this.updateSupabasePassword(user.authUserId, password);
    const passwordUpdatedAt = new Date();
    try {
      await this.prisma.$transaction([
        this.prisma.userProfile.update({
          where: { id },
          data: { passwordUpdatedAt },
        }),
        this.prisma.auditLog.create({
          data: {
            userId: actor.id,
            action: "USER_PASSWORD_RESET",
            entityType: "USER",
            entityId: id,
            metadata: { username: user.username },
          },
        }),
      ]);
    } catch (error) {
      this.logger.error("Supabase password changed but local password metadata could not be saved.", error);
      throw new ServiceUnavailableException(
        "Password was changed, but local audit metadata could not be saved. Verify the new password before retrying.",
      );
    }
    return { success: true, passwordUpdatedAt: passwordUpdatedAt.toISOString() };
  }

  private async createSupabaseUser(input: CreateUserDto, email: string) {
    const { secret, url } = this.supabaseAdminConfig();
    const response = await fetch(`${url}/auth/v1/admin/users`, { method: "POST", headers: { apikey: secret, authorization: `Bearer ${secret}`, "content-type": "application/json" }, body: JSON.stringify({ email, password: input.password, email_confirm: true, user_metadata: { username: input.username, full_name: input.fullName } }) });
    if (!response.ok) throw new BadRequestException("Supabase user creation failed.");
    const user = await response.json() as { id?: string };
    if (!user.id) throw new BadRequestException("Supabase user creation returned no user ID.");
    return user.id;
  }

  private async updateSupabasePassword(authUserId: string, password: string) {
    const { secret, url } = this.supabaseAdminConfig();
    const response = await fetch(`${url}/auth/v1/admin/users/${authUserId}`, {
      method: "PUT",
      headers: { apikey: secret, authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) throw new BadRequestException("Supabase password update failed.");
  }

  private async deleteSupabaseUser(authUserId: string) {
    const { secret, url } = this.supabaseAdminConfig();
    const response = await fetch(`${url}/auth/v1/admin/users/${authUserId}`, {
      method: "DELETE",
      headers: { apikey: secret, authorization: `Bearer ${secret}` },
    });
    if (!response.ok) throw new Error("Supabase user cleanup failed.");
  }

  private supabaseAdminConfig() {
    return {
      secret: this.config.getOrThrow<string>("SUPABASE_SECRET_KEY"),
      url: this.config.getOrThrow<string>("SUPABASE_URL").replace(/\/$/, ""),
    };
  }

  private toResponse(
    user: Prisma.UserProfileGetPayload<{ include: { role: true } }>,
    resetRequestedAt?: Date,
  ) {
    const pendingReset = resetRequestedAt
      && (!user.passwordUpdatedAt || resetRequestedAt > user.passwordUpdatedAt)
      ? resetRequestedAt.toISOString()
      : null;
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      status: user.status,
      role: user.role.code,
      passwordConfigured: Boolean(user.passwordUpdatedAt),
      passwordUpdatedAt: user.passwordUpdatedAt?.toISOString() ?? null,
      passwordResetRequestedAt: pendingReset,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private async audit(user: AuthUser, action: string, entityId: string, metadata: Prisma.InputJsonValue) { await this.prisma.auditLog.create({ data: { userId: user.id, action, entityType: "USER", entityId, metadata } }); }
  private handleKnownError(error: unknown) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Username already exists."); }
}
