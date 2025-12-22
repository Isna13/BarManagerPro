import { IsEmail, IsString, MinLength, IsEnum, IsUUID, IsOptional, IsBoolean, IsArray } from 'class-validator';

export enum UserRole {
  ADMIN = 'admin',
  OWNER = 'owner',
  MANAGER = 'manager',
  CASHIER = 'cashier',
  WAITER = 'waiter',
}

export class CreateUserDto {
  @IsString()
  @IsOptional()
  id?: string; // ID do Electron para manter consistência

  @IsString()
  @IsOptional()
  username?: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @IsOptional()
  role?: string; // Aceitar string para flexibilidade

  @IsUUID()
  @IsOptional()
  branchId?: string; // Opcional - pode usar default

  @IsString()
  @IsOptional()
  phone?: string;

  @IsArray()
  @IsOptional()
  allowedTabs?: string[]; // Array de abas permitidas

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
