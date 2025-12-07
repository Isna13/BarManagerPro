import { IsString, IsInt, IsOptional, Min, IsEnum, IsUUID } from 'class-validator';

export class OpenCashBoxDto {
  @IsOptional()
  @IsUUID()
  id?: string; // ID opcional para sincronização com Electron

  @IsString()
  branchId: string;

  @IsInt()
  @Min(0)
  openingAmount: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  boxNumber?: string; // Box number opcional para sincronização
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
