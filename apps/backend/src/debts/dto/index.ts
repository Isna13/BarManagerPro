import { IsString, IsInt, IsOptional, Min, IsDateString } from 'class-validator';

export class CreateDebtDto {
  @IsString()
  customerId: string;

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
