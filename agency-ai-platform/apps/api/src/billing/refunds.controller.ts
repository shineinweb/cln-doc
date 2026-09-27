import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";
import type { AuthUserView } from "@agency/auth";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Permissions } from "../common/decorators/permissions.decorator";
import { StaffGuard } from "../common/guards/staff.guard";
import { RefundsService } from "./refunds.service";

class IssueRefundBodyDto {
  @IsString()
  @MinLength(1)
  paymentExternalId!: string;

  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsString()
  @MinLength(1)
  idempotencyKey!: string;
}

@Controller("admin/billing/refunds")
@UseGuards(StaffGuard)
export class RefundsController {
  constructor(private readonly refunds: RefundsService) {}

  @Post()
  @Permissions("billing.refund")
  async issue(@Body() dto: IssueRefundBodyDto, @CurrentUser() user: AuthUserView) {
    const result = await this.refunds.issueRefund(user, dto);
    return { data: result };
  }
}
