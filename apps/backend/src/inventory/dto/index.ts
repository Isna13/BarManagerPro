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

export class UpsertInventoryItemDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  productId: string;

  @IsString()
  branchId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  qtyUnits?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  qtyBoxes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  closedBoxes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  openBoxUnits?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minStock?: number;

  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsOptional()
  expiryDate?: Date | string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsNumber()
  consumptionAvg7d?: number;

  @IsOptional()
  @IsNumber()
  consumptionAvg15d?: number;

  @IsOptional()
  @IsNumber()
  consumptionAvg30d?: number;

  @IsOptional()
  @IsInt()
  daysUntilStockout?: number;

  @IsOptional()
  @IsInt()
  suggestedReorder?: number;
}
