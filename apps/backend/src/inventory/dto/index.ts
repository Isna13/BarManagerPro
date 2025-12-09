import { IsString, IsInt, IsOptional, Min, IsNumber } from 'class-validator';

export class AddStockDto {
  @IsString()
  productId: string;

  @IsString()
  branchId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  qtyBoxes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  qtyUnits?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class TransferStockDto {
  @IsString()
  productId: string;

  @IsString()
  fromBranchId: string;

  @IsString()
  toBranchId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  qtyBoxes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  qtyUnits?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AdjustStockDto {
  @IsString()
  inventoryItemId: string;

  @IsInt()
  @Min(0)
  qtyUnits: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AdjustStockByProductDto {
  @IsString()
  productId: string;

  @IsString()
  branchId: string;

  @IsNumber()
  adjustment: number; // Pode ser negativo (venda) ou positivo (entrada)

  @IsOptional()
  @IsString()
  reason?: string;
}
