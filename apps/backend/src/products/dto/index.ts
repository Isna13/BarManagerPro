import { IsString, IsInt, IsOptional, IsBoolean, Min, IsUUID, IsNumber } from 'class-validator';

export class CreateProductDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  unitsPerBox?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceUnit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceBox?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  costUnit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  costBox?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  taxRate?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minMarginPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minStock?: number;

  @IsOptional()
  @IsBoolean()
  trackInventory?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  unitsPerBox?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceUnit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceBox?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  costUnit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  costBox?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  taxRate?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minMarginPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minStock?: number;

  @IsOptional()
  @IsBoolean()
  trackInventory?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
