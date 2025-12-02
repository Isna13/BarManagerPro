import { IsString, IsOptional, IsInt, IsBoolean, Min, Max } from 'class-validator';

export class CreateTableDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  branchId: string;

  @IsString()
  number: string;

  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  seats?: number = 4;

  @IsString()
  @IsOptional()
  area?: string;

  @IsString()
  @IsOptional()
  qrCode?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}

export class UpdateTableDto {
  @IsString()
  @IsOptional()
  number?: string;

  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  seats?: number;

  @IsString()
  @IsOptional()
  area?: string;

  @IsString()
  @IsOptional()
  qrCode?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
