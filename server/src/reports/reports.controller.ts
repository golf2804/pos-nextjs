import { Controller, Get, Header, Query, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { AppRole } from "../auth/roles.enum.js";
import { ReportExportDto, ReportQueryDto } from "./dto/report.dto.js";
import { ReportsService } from "./reports.service.js";

type ExportResponse = {
  setHeader(name: string, value: string): void;
  send(body: string | Buffer): void;
};

@Roles(AppRole.ADMIN, AppRole.MANAGER)
@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @Header("Cache-Control", "private, max-age=60, stale-while-revalidate=120")
  get(@Query() query: ReportQueryDto) { return this.reportsService.getReport(query); }

  @Get("export")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Header("Cache-Control", "no-store")
  async export(@Query() query: ReportExportDto, @Res() response: ExportResponse) {
    if (query.format === "excel") {
      const workbook = await this.reportsService.toExcel(query);
      response.setHeader("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      response.setHeader("content-disposition", `attachment; filename="inventory-${query.period}.xlsx"`);
      response.send(workbook);
      return;
    }
    const pdf = await this.reportsService.toPdf(query);
    response.setHeader("content-type", "application/pdf");
    response.setHeader("content-disposition", `attachment; filename=inventory-${query.period}.pdf`);
    response.send(pdf);
  }
}
