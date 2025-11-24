import { IsEmail, IsString, MinLength, IsEnum, IsUUID, IsOptional, IsBoolean } from 'class-validator';

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  CASHIER = 'cashier',
  WAITER = 'waiter',
}

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsUUID()
  branchId: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}
