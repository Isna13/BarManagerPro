import { IsOptional, IsEnum, IsUUID, IsDateString } from 'class-validator';
import { SyncEntity, SyncOperation } from './create-sync-item.dto';

export class SyncQueryDto {
  @IsOptional()
  @IsEnum(SyncEntity)
  entity?: SyncEntity;

  @IsOptional()
  @IsEnum(SyncOperation)
  operation?: SyncOperation;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsDateString()
  since?: string;

  @IsOptional()
  @IsDateString()
  until?: string;
}
