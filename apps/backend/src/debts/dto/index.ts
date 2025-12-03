import { IsString, IsInt, IsOptional, Min, IsDateString } from 'class-validator';

export class CreateDebtDto {
  @IsOptional()
  @IsString()
  id?: string; // ID opcional para sincronização do Electron

  @IsOptional()
  @IsString()
  debtNumber?: string; // Número opcional para sincronização

  @IsString()
  customerId: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  saleId?: string;

  @IsInt()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class PayDebtDto {
  @IsInt()
  @Min(1)
  amount: number;

  @IsString()
  method: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateDebtDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  paidAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  paid?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  balance?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
