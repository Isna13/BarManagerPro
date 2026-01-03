import { IsString, IsInt, IsOptional, Min, IsIn } from 'class-validator';

export class CreatePurchaseDto {
  @IsOptional()
  @IsString()
  id?: string; // ID opcional para sincronização

  @IsOptional()
  @IsString()
  purchaseNumber?: string; // Número opcional para sincronização

  @IsString()
  branchId: string;

  @IsString()
  supplierId: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsInt()
  total?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePurchaseDto {
  @IsOptional()
  @IsString()
  @IsIn(['pending', 'received', 'completed', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsInt()
  total?: number;
}

export class AddPurchaseItemDto {
  @IsOptional()
  @IsString()
  id?: string; // ID opcional para idempotência - se já existe, ignora

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

  @IsOptional()
  @IsInt()
  @Min(0)
  subtotal?: number;
}
