import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { StockController } from "./stock.controller.js";
import { StockService } from "./stock.service.js";
import { InventoryOperationsService } from "./inventory-operations.service.js";

@Module({
  imports: [NotificationsModule],
  controllers: [StockController],
  providers: [StockService, InventoryOperationsService],
  exports: [InventoryOperationsService],
})
export class StockModule {}
