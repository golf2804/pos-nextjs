import { Controller, Get, Header } from "@nestjs/common";
import { DashboardService } from "./dashboard.service.js";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @Header("Cache-Control", "private, max-age=15, stale-while-revalidate=30")
  getDashboard() {
    return this.dashboardService.getDashboard();
  }
}
