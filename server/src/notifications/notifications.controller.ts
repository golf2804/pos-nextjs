import { Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from "@nestjs/common";
import type { AuthUser } from "../auth/auth-user.interface.js";
import { ListNotificationsDto } from "./dto/notification.dto.js";
import { NotificationsService } from "./notifications.service.js";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}
  @Get()
  list(@Query() query: ListNotificationsDto, @Req() request: { user: AuthUser }) {
    return this.notificationsService.list(query, request.user);
  }

  @Patch(":id/read")
  markRead(@Param("id", ParseUUIDPipe) id: string, @Req() request: { user: AuthUser }) {
    return this.notificationsService.markRead(id, request.user);
  }

  @Post("read-all")
  markAllRead(@Req() request: { user: AuthUser }) {
    return this.notificationsService.markAllRead(request.user);
  }
}
