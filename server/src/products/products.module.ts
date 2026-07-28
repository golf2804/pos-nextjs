import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { ProductsController } from "./products.controller.js";
import { ProductsService } from "./products.service.js";

@Module({
  imports: [NotificationsModule],
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
