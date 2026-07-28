import { api } from "@/lib/api";

export type ReportPeriod = "daily" | "weekly" | "monthly" | "yearly";
export type InventoryReport = { period: ReportPeriod; range: { from: string; to: string }; summary: { stockIn: number; stockOut: number; stockInValue: number; stockOutValue: number; totalQuantityOnHand: number; lowStock: number; outOfStock: number }; movement: { bucket: string; stockIn: number; stockOut: number; stockInValue: number; stockOutValue: number }[] };

export async function getReport(period: ReportPeriod, dateFrom?: string, dateTo?: string) { const { data } = await api.get<InventoryReport>("/reports", { params: { period, dateFrom, dateTo } }); return data; }

export async function downloadReport(
  period: ReportPeriod,
  format: "pdf" | "excel",
  dateFrom?: string,
  dateTo?: string,
) {
  const response = await api.get<Blob>("/reports/export", {
    params: { period, format, dateFrom, dateTo },
    responseType: "blob",
  });
  const fallbackName = `inventory-${period}.${format === "excel" ? "xlsx" : "pdf"}`;
  const filename = getDownloadFilename(response.headers["content-disposition"], fallbackName);
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return filename;
}

function getDownloadFilename(contentDisposition: string | undefined, fallback: string) {
  const encoded = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) return decodeURIComponent(encoded);
  return contentDisposition?.match(/filename="?([^";]+)"?/i)?.[1] ?? fallback;
}
