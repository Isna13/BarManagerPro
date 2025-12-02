import { IsString, IsOptional, IsInt, Min, IsEmail, IsUUID, IsBoolean } from 'class-validator';

export class CreateCustomerDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  nif?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  creditLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  loyaltyPoints?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  nif?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  creditLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  loyaltyPoints?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
