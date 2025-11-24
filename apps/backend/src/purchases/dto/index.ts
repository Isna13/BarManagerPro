import { IsString, IsInt, IsOptional, Min } from 'class-validator';

export class CreatePurchaseDto {
  @IsString()
  branchId: string;

  @IsString()
  supplierId: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AddPurchaseItemDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  qtyBoxes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  qtyUnits?: number;

  @IsInt()
  @Min(0)
  unitCost: number;
}
