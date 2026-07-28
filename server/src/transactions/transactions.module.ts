import { Module } from "@nestjs/common";
import { TransactionsController } from "./transactions.controller.js";
import { TransactionsService } from "./transactions.service.js";
import { StockModule } from "../stock/stock.module.js";

@Module({ imports: [StockModule], controllers: [TransactionsController], providers: [TransactionsService] })
export class TransactionsModule {}
