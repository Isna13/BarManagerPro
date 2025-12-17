import { IsString, IsEnum, IsUUID, IsOptional } from 'class-validator';

export enum SyncOperation {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
}

export enum SyncEntity {
  SALE = 'sale',
  CUSTOMER = 'customer',
  INVENTORY = 'inventory',
  PRODUCT = 'product',
  DEBT = 'debt',
  PAYMENT = 'payment',
  TABLE = 'table',
  TABLE_SESSION = 'table_session',
  TABLE_CUSTOMER = 'table_customer',
  TABLE_ORDER = 'table_order',
}

export class CreateSyncItemDto {
  @IsEnum(SyncEntity)
  entity: SyncEntity;

  @IsEnum(SyncOperation)
  operation: SyncOperation;

  @IsUUID()
  entityId: string;

  @IsString()
  data: string; // JSON string

  @IsUUID()
  @IsOptional()
  branchId?: string;

  @IsString()
  @IsOptional()
  deviceId?: string;
}
