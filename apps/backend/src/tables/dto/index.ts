import { IsString, IsOptional, IsInt, IsBoolean, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

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

  @Transform(({ value }) => value === true || value === 1 || value === '1' || value === 'true')
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

  @Transform(({ value }) => value === true || value === 1 || value === '1' || value === 'true')
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
