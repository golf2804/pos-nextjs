import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Req } from "@nestjs/common";
import type { AuthUser } from "../auth/auth-user.interface.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { AppRole } from "../auth/roles.enum.js";
import { StockInDto, StockOutDto } from "./dto/stock.dto.js";
import { ReconcileInventoryDto, ReturnInDto, ReturnOutDto, StockAdjustmentDto } from "./dto/inventory-operation.dto.js";
import { InventoryOperationsService } from "./inventory-operations.service.js";
import { StockService } from "./stock.service.js";

@Controller()
export class StockController {
  constructor(
    private readonly stockService: StockService,
    private readonly inventoryOperations: InventoryOperationsService,
  ) {}

  @Roles(AppRole.ADMIN, AppRole.MANAGER)
  @Post("stock-adjustments")
  adjust(
    @Body() body: StockAdjustmentDto,
    @Req() request: { user: AuthUser },
    @Headers("idempotency-key") requestKey: string,
  ) {
    return this.inventoryOperations.adjust(body, request.user, requestKey);
  }

  @Roles(AppRole.ADMIN, AppRole.MANAGER, AppRole.STAFF)
  @Post("returns/in")
  returnIn(
    @Body() body: ReturnInDto,
    @Req() request: { user: AuthUser },
    @Headers("idempotency-key") requestKey: string,
  ) {
    return this.inventoryOperations.returnIn(body, request.user, requestKey);
  }

  @Roles(AppRole.ADMIN, AppRole.MANAGER, AppRole.STAFF)
  @Post("returns/out")
  returnOut(
    @Body() body: ReturnOutDto,
    @Req() request: { user: AuthUser },
    @Headers("idempotency-key") requestKey: string,
  ) {
    return this.inventoryOperations.returnOut(body, request.user, requestKey);
  }

  @Roles(AppRole.ADMIN, AppRole.MANAGER)
  @Get("inventory/reconciliation")
  reconciliation() {
    return this.inventoryOperations.reconciliation();
  }

  @Roles(AppRole.ADMIN)
  @Post("inventory/reconciliation/:productId/repair")
  repairReconciliation(
    @Param("productId", ParseUUIDPipe) productId: string,
    @Body() body: ReconcileInventoryDto,
    @Req() request: { user: AuthUser },
    @Headers("idempotency-key") requestKey: string,
  ) {
    return this.inventoryOperations.repairReconciliation(productId, body, request.user, requestKey);
  }

  @Roles(AppRole.ADMIN, AppRole.MANAGER, AppRole.STAFF)
  @Post("stock-in")
  stockIn(
    @Body() body: StockInDto,
    @Req() request: { user: AuthUser },
    @Headers("idempotency-key") requestKey: string,
  ) {
    return this.stockService.stockIn(body, request.user, requestKey);
  }

  @Roles(AppRole.ADMIN, AppRole.MANAGER, AppRole.STAFF)
  @Post("stock-out")
  stockOut(
    @Body() body: StockOutDto,
    @Req() request: { user: AuthUser },
    @Headers("idempotency-key") requestKey: string,
  ) {
    return this.stockService.stockOut(body, request.user, requestKey);
  }
}
