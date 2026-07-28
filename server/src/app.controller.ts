import { Controller, Get } from "@nestjs/common";
import { Public } from "./auth/decorators/public.decorator.js";
import { PrismaService } from "./prisma/prisma.service.js";

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  index() {
    return {
      service: "inventory-api",
      version: "1.0.0",
      basePath: "/api",
      authentication: "Bearer Supabase access token, except public auth/login and health endpoints.",
      resources: [
        {
          name: "Authentication",
          path: "/auth",
          endpoints: [
            "POST /auth/login",
            "GET /auth/me",
          ],
        },
        {
          name: "Users",
          path: "/users",
          roles: ["ADMIN"],
          endpoints: ["GET /users", "POST /users", "PATCH /users/:id", "DELETE /users/:id"],
        },
        {
          name: "Products",
          path: "/products",
          endpoints: ["GET /products", "GET /products/options", "GET /products/:id", "POST /products", "PATCH /products/:id", "DELETE /products/:id"],
        },
        {
          name: "Categories",
          path: "/categories",
          endpoints: ["GET /categories", "GET /categories/:id", "POST /categories", "PATCH /categories/:id", "DELETE /categories/:id"],
        },
        {
          name: "Suppliers",
          path: "/suppliers",
          endpoints: ["GET /suppliers", "GET /suppliers/:id", "POST /suppliers", "PATCH /suppliers/:id", "DELETE /suppliers/:id"],
        },
        {
          name: "Stock Operations",
          path: "/stock-in, /stock-out",
          endpoints: ["POST /stock-in", "POST /stock-out"],
        },
        {
          name: "Transactions",
          path: "/transactions",
          endpoints: ["GET /transactions"],
        },
        {
          name: "Reports",
          path: "/reports",
          endpoints: ["GET /reports", "GET /reports/export"],
        },
        {
          name: "Notifications",
          path: "/notifications",
          endpoints: ["GET /notifications", "PATCH /notifications/:id/read", "POST /notifications/read-all"],
        },
        {
          name: "Dashboard",
          path: "/dashboard",
          endpoints: ["GET /dashboard"],
        },
      ],
    };
  }

  @Public()
  @Get("health")
  health() {
    return { status: "ok", service: "inventory-api", uptimeSeconds: Math.floor(process.uptime()), timestamp: new Date().toISOString() };
  }

  @Public()
  @Get("health/ready")
  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: "ready", database: "up", timestamp: new Date().toISOString() };
  }
}
