import { IsString, IsInt, IsOptional, Min, IsEnum } from 'class-validator';

export class OpenCashBoxDto {
  @IsString()
  branchId: string;

  @IsInt()
  @Min(0)
  openingAmount: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CloseCashBoxDto {
  @IsInt()
  @Min(0)
  closingAmount: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AddTransactionDto {
  @IsEnum(['in', 'out'])
  type: 'in' | 'out';

  @IsInt()
  @Min(1)
  amount: number;

  @IsString()
  reason: string;
}
