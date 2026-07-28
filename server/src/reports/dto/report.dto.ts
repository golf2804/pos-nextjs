import { IsDateString, IsIn, IsOptional } from "class-validator";

export class ReportQueryDto {
  @IsIn(["daily", "weekly", "monthly", "yearly"])
  period!: "daily" | "weekly" | "monthly" | "yearly";

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

export class ReportExportDto extends ReportQueryDto {
  @IsIn(["pdf", "excel"])
  format!: "pdf" | "excel";
}
