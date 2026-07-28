import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AppController } from "./app.controller.js";
import { AuthModule } from "./auth/auth.module.js";
import { RolesGuard } from "./auth/guards/roles.guard.js";
import { SupabaseAuthGuard } from "./auth/guards/supabase-auth.guard.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { DashboardModule } from "./dashboard/dashboard.module.js";
import { ProductsModule } from "./products/products.module.js";
import { CategoriesModule } from "./categories/categories.module.js";
import { SuppliersModule } from "./suppliers/suppliers.module.js";
import { StockModule } from "./stock/stock.module.js";
import { TransactionsModule } from "./transactions/transactions.module.js";
import { ReportsModule } from "./reports/reports.module.js";
import { UsersModule } from "./users/users.module.js";
import { NotificationsModule } from "./notifications/notifications.module.js";
import { SearchModule } from "./search/search.module.js";
import { CommonModule } from "./common/common.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    DashboardModule,
    ProductsModule,
    CategoriesModule,
    SuppliersModule,
    StockModule,
    TransactionsModule,
    ReportsModule,
    UsersModule,
    NotificationsModule,
    SearchModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
