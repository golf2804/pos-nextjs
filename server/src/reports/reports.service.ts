import { BadRequestException, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import ExcelJS from "exceljs";
import { resolve } from "node:path";
import PDFDocument from "pdfkit";
import { PrismaService } from "../prisma/prisma.service.js";
import type { ReportQueryDto } from "./dto/report.dto.js";
import { TtlCacheService } from "../common/ttl-cache.service.js";

type SummaryRow = { bucket: string; stockIn: Prisma.Decimal; stockOut: Prisma.Decimal; stockInValue: Prisma.Decimal; stockOutValue: Prisma.Decimal };
const MAX_EXPORT_ROWS = 1_000;
const MAX_CONCURRENT_EXPORTS = 2;
const MAX_RANGE_DAYS: Record<ReportQueryDto["period"], number> = {
  daily: 31,
  weekly: 92,
  monthly: 366,
  yearly: 366,
};

@Injectable()
export class ReportsService {
  private activeExports = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: TtlCacheService = new TtlCacheService(),
  ) {}

  async getReport(query: ReportQueryDto) {
    const key = `reports:${query.period}:${query.dateFrom ?? "auto"}:${query.dateTo ?? "auto"}`;
    return this.cache.getOrSet(key, 60_000, () => this.loadReport(query));
  }

  private async loadReport(query: ReportQueryDto) {
    const range = this.resolveRange(query);
    const bucket = query.period === "yearly" ? "month" : query.period === "monthly" ? "day" : query.period === "weekly" ? "day" : "hour";
    const movement = await this.prisma.$queryRaw<SummaryRow[]>(Prisma.sql`
      SELECT
        to_char(date_trunc(${bucket}, t.transaction_date AT TIME ZONE 'Asia/Bangkok'), 'YYYY-MM-DD HH24:00') AS bucket,
        COALESCE(SUM(i.quantity) FILTER (WHERE t.type IN ('STOCK_IN', 'RETURN_IN')), 0) AS "stockIn",
        COALESCE(SUM(i.quantity) FILTER (WHERE t.type IN ('STOCK_OUT', 'RETURN_OUT')), 0) AS "stockOut",
        COALESCE(SUM(i.quantity * i.unit_cost) FILTER (WHERE t.type IN ('STOCK_IN', 'RETURN_IN')), 0) AS "stockInValue",
        COALESCE(SUM(i.quantity * i.unit_cost) FILTER (WHERE t.type IN ('STOCK_OUT', 'RETURN_OUT')), 0) AS "stockOutValue"
      FROM inventory_transactions t
      JOIN inventory_transaction_items i ON i.transaction_id = t.id
      WHERE t.status = 'CONFIRMED' AND t.transaction_date >= ${range.from} AND t.transaction_date < ${range.toExclusive}
      GROUP BY 1
      ORDER BY 1
    `);
    const [inventoryValue, lowStock, outOfStock] = await Promise.all([
      this.prisma.product.aggregate({ where: { status: "ACTIVE" }, _sum: { quantity: true } }),
      this.prisma.product.count({ where: { status: "ACTIVE", quantity: { gt: 0, lte: this.prisma.product.fields.minimumStock } } }),
      this.prisma.product.count({ where: { status: "ACTIVE", quantity: 0 } }),
    ]);
    const rows = movement.map((row) => ({ bucket: row.bucket, stockIn: Number(row.stockIn), stockOut: Number(row.stockOut), stockInValue: Number(row.stockInValue), stockOutValue: Number(row.stockOutValue) }));
    return {
      period: query.period,
      range: { from: range.from.toISOString(), to: new Date(range.toExclusive.getTime() - 1).toISOString() },
      summary: {
        stockIn: rows.reduce((sum, row) => sum + row.stockIn, 0),
        stockOut: rows.reduce((sum, row) => sum + row.stockOut, 0),
        stockInValue: rows.reduce((sum, row) => sum + row.stockInValue, 0),
        stockOutValue: rows.reduce((sum, row) => sum + row.stockOutValue, 0),
        totalQuantityOnHand: Number(inventoryValue._sum.quantity ?? 0),
        lowStock,
        outOfStock,
      },
      movement: rows,
    };
  }

  async toExcel(query: ReportQueryDto) {
    return this.withExportSlot(() => this.buildExcel(query));
  }

  private async buildExcel(query: ReportQueryDto) {
    const report = await this.getReport(query);
    this.assertExportSize(report.movement.length);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "POS Inventory";
    workbook.created = new Date();

    const summary = workbook.addWorksheet("Summary", { views: [{ state: "frozen", ySplit: 1 }] });
    summary.columns = [{ width: 28 }, { width: 22 }];
    summary.addRow(["Inventory Report", report.period.toUpperCase()]);
    summary.addRows([
      ["Date From", report.range.from.slice(0, 10)],
      ["Date To", report.range.to.slice(0, 10)],
      ["Stock In", report.summary.stockIn],
      ["Stock Out", report.summary.stockOut],
      ["Stock In Value (THB)", report.summary.stockInValue],
      ["Stock Out Value (THB)", report.summary.stockOutValue],
      ["Quantity On Hand", report.summary.totalQuantityOnHand],
      ["Low Stock Products", report.summary.lowStock],
      ["Out Of Stock Products", report.summary.outOfStock],
    ]);
    styleHeader(summary.getRow(1));
    summary.getColumn(2).numFmt = "#,##0.00";

    const movement = workbook.addWorksheet("Movement", { views: [{ state: "frozen", ySplit: 1 }] });
    movement.columns = [
      { header: "Bucket", key: "bucket", width: 24 },
      { header: "Stock In", key: "stockIn", width: 16 },
      { header: "Stock Out", key: "stockOut", width: 16 },
      { header: "Stock In Value (THB)", key: "stockInValue", width: 24 },
      { header: "Stock Out Value (THB)", key: "stockOutValue", width: 24 },
    ];
    movement.addRows(report.movement);
    styleHeader(movement.getRow(1));
    movement.autoFilter = { from: "A1", to: "E1" };
    for (const column of [2, 3, 4, 5]) movement.getColumn(column).numFmt = "#,##0.00";
    movement.eachRow((row, rowNumber) => {
      if (rowNumber > 1 && rowNumber % 2 === 1) row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async toPdf(query: ReportQueryDto) {
    return this.withExportSlot(() => this.buildPdf(query));
  }

  private async buildPdf(query: ReportQueryDto) {
    const report = await this.getReport(query);
    this.assertExportSize(report.movement.length);
    const fontPath = resolve(process.cwd(), "assets", "fonts", "NotoSansThai.ttf");
    return new Promise<Buffer>((resolvePdf, reject) => {
      const document = new PDFDocument({ size: "A4", margin: 42, info: { Title: `Inventory report - ${report.period}`, Author: "POS Inventory" } });
      const chunks: Buffer[] = [];
      document.on("data", (chunk: Buffer) => chunks.push(chunk));
      document.on("end", () => resolvePdf(Buffer.concat(chunks)));
      document.on("error", reject);
      document.registerFont("NotoSansThai", fontPath);
      document.font("NotoSansThai");

      document.fontSize(20).fillColor("#0f172a").text("รายงานสินค้าคงคลัง", { align: "center" });
      document.fontSize(10).fillColor("#64748b").text(`รอบรายงาน: ${periodLabel(report.period)}  |  ${report.range.from.slice(0, 10)} - ${report.range.to.slice(0, 10)}`, { align: "center" });
      document.moveDown(1.5);

      const metrics = [
        ["รับเข้าสินค้า", report.summary.stockIn],
        ["เบิกออกสินค้า", report.summary.stockOut],
        ["มูลค่ารับเข้า", report.summary.stockInValue],
        ["มูลค่าเบิกออก", report.summary.stockOutValue],
        ["จำนวนคงเหลือ", report.summary.totalQuantityOnHand],
        ["สินค้าใกล้หมด", report.summary.lowStock],
        ["สินค้าหมด", report.summary.outOfStock],
      ] as const;
      metrics.forEach(([label, value], index) => {
        const column = index % 2;
        const row = Math.floor(index / 2);
        const x = 42 + column * 255;
        const y = 120 + row * 42;
        document.roundedRect(x, y, 238, 32, 4).fillAndStroke("#f8fafc", "#e2e8f0");
        document.fillColor("#475569").fontSize(9).text(label, x + 10, y + 6, { width: 130 });
        document.fillColor("#0f172a").fontSize(11).text(formatNumber(value), x + 140, y + 6, { width: 88, align: "right" });
      });

      let y = 306;
      drawPdfTableHeader(document, y);
      y += 28;
      if (!report.movement.length) {
        document.fillColor("#64748b").fontSize(10).text("ไม่มีรายการเคลื่อนไหวในช่วงเวลาที่เลือก", 42, y + 12, { width: 511, align: "center" });
      } else {
        for (const row of report.movement) {
          if (y > 748) {
            document.addPage();
            y = 48;
            drawPdfTableHeader(document, y);
            y += 28;
          }
          document.fillColor("#334155").fontSize(8.5);
          document.text(row.bucket, 48, y + 7, { width: 145 });
          document.text(formatNumber(row.stockIn), 198, y + 7, { width: 72, align: "right" });
          document.text(formatNumber(row.stockOut), 278, y + 7, { width: 72, align: "right" });
          document.text(formatNumber(row.stockInValue), 358, y + 7, { width: 88, align: "right" });
          document.text(formatNumber(row.stockOutValue), 454, y + 7, { width: 92, align: "right" });
          document.moveTo(42, y + 25).lineTo(553, y + 25).strokeColor("#e2e8f0").stroke();
          y += 26;
        }
      }
      document.end();
    });
  }

  private resolveRange(query: ReportQueryDto) {
    if (Boolean(query.dateFrom) !== Boolean(query.dateTo)) {
      throw new BadRequestException("dateFrom and dateTo must be provided together.");
    }
    if (query.dateFrom && query.dateTo) {
      const from = bangkokStartOfDay(query.dateFrom);
      const toInclusive = bangkokStartOfDay(query.dateTo);
      if (from > toInclusive) throw new BadRequestException("dateFrom must be before or equal to dateTo.");
      const toExclusive = new Date(toInclusive);
      toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
      const spanDays = (toExclusive.getTime() - from.getTime()) / 86_400_000;
      if (spanDays > MAX_RANGE_DAYS[query.period]) {
        throw new BadRequestException(`${query.period} reports are limited to ${MAX_RANGE_DAYS[query.period]} days.`);
      }
      return { from, toExclusive };
    }
    const now = new Date();
    const from = new Date(now);
    if (query.period === "daily") from.setHours(0, 0, 0, 0);
    if (query.period === "weekly") from.setDate(now.getDate() - 6);
    if (query.period === "monthly") from.setMonth(now.getMonth() - 1);
    if (query.period === "yearly") from.setFullYear(now.getFullYear() - 1);
    return { from, toExclusive: new Date(now.getTime() + 1) };
  }

  private assertExportSize(rowCount: number) {
    if (rowCount > MAX_EXPORT_ROWS) {
      throw new BadRequestException(`Report export exceeds the ${MAX_EXPORT_ROWS}-row limit.`);
    }
  }

  private async withExportSlot<T>(work: () => Promise<T>) {
    if (this.activeExports >= MAX_CONCURRENT_EXPORTS) {
      throw new HttpException("Too many report exports are running. Try again shortly.", HttpStatus.TOO_MANY_REQUESTS);
    }
    this.activeExports += 1;
    try {
      return await work();
    } finally {
      this.activeExports -= 1;
    }
  }
}

function bangkokStartOfDay(date: string) {
  return new Date(`${date}T00:00:00.000+07:00`);
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
  row.alignment = { vertical: "middle" };
  row.height = 24;
}

function drawPdfTableHeader(document: PDFKit.PDFDocument, y: number) {
  document.rect(42, y, 511, 28).fill("#0f766e");
  document.fillColor("#ffffff").fontSize(8.5);
  document.text("ช่วงเวลา", 48, y + 8, { width: 145 });
  document.text("รับเข้า", 198, y + 8, { width: 72, align: "right" });
  document.text("เบิกออก", 278, y + 8, { width: 72, align: "right" });
  document.text("มูลค่ารับเข้า", 358, y + 8, { width: 88, align: "right" });
  document.text("มูลค่าเบิกออก", 454, y + 8, { width: 92, align: "right" });
}

function periodLabel(period: ReportQueryDto["period"]) {
  return { daily: "รายวัน", weekly: "รายสัปดาห์", monthly: "รายเดือน", yearly: "รายปี" }[period];
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(value);
}
