import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

export class ListNotificationsDto {
  @IsOptional()
  @IsIn(["LOW_STOCK", "OUT_OF_STOCK"])
  type?: "LOW_STOCK" | "OUT_OF_STOCK";

  @IsOptional()
  @IsIn(["active", "unread", "read", "resolved", "all"])
  status: "active" | "unread" | "read" | "resolved" | "all" = "active";

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;
}
