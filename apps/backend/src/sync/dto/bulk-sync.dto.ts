import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSyncItemDto } from './create-sync-item.dto';

export class BulkSyncDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSyncItemDto)
  items: CreateSyncItemDto[];
}
