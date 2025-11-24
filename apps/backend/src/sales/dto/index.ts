import { IsUUID, IsOptional, IsString, IsInt, Min, IsBoolean } from 'class-validator';

export class CreateSaleDto {
  @IsUUID()
  branchId: string;

  @IsString()
  @IsOptional()
  type?: string; // counter, table

  @IsUUID()
  @IsOptional()
  tableId?: string;

  @IsUUID()
  @IsOptional()
  customerId?: string;
}

export class AddSaleItemDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  qtyUnits: number;

  @IsBoolean()
  @IsOptional()
  isMuntu?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ProcessPaymentDto {
  @IsString()
  method: string; // cash, card, mobile_money, debt

  @IsInt()
  @Min(0)
  amount: number;

  @IsString()
  @IsOptional()
  provider?: string;

  @IsString()
  @IsOptional()
  referenceNumber?: string;

  @IsString()
  @IsOptional()
  transactionId?: string;
}
