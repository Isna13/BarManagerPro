import { IsString, IsOptional, IsUUID, IsEnum } from 'class-validator';

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  EXPORT = 'EXPORT',
}

export enum AuditEntity {
  USER = 'USER',
  CUSTOMER = 'CUSTOMER',
  PRODUCT = 'PRODUCT',
  SALE = 'SALE',
  DEBT = 'DEBT',
  PAYMENT = 'PAYMENT',
  BACKUP = 'BACKUP',
}

export class CreateAuditDto {
  @IsUUID()
  userId: string;

  @IsEnum(AuditAction)
  action: AuditAction;

  @IsEnum(AuditEntity)
  entity: AuditEntity;

  @IsUUID()
  @IsOptional()
  entityId?: string;

  @IsString()
  @IsOptional()
  details?: string;

  @IsString()
  @IsOptional()
  ipAddress?: string;
}
