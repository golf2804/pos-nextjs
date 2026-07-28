import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query, Req } from "@nestjs/common";
import type { AuthUser } from "../auth/auth-user.interface.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { AppRole } from "../auth/roles.enum.js";
import { ReverseTransactionDto } from "../stock/dto/inventory-operation.dto.js";
import { InventoryOperationsService } from "../stock/inventory-operations.service.js";
import { ListTransactionsDto } from "./dto/transaction.dto.js";
import { TransactionsService } from "./transactions.service.js";

@Controller("transactions")
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly inventoryOperations: InventoryOperationsService,
  ) {}

  @Roles(AppRole.ADMIN, AppRole.MANAGER)
  @Post(":id/reverse")
  reverse(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: ReverseTransactionDto,
    @Req() request: { user: AuthUser },
    @Headers("idempotency-key") requestKey: string,
  ) {
    return this.inventoryOperations.reverse(id, body, request.user, requestKey);
  }

  @Get()
  list(@Query() query: ListTransactionsDto) {
    return this.transactionsService.list(query);
  }
}
