import { IsUUID, IsInt, Min, IsString, IsOptional } from 'class-validator';

export class AddPointsDto {
  @IsUUID()
  customerId: string;

  @IsInt()
  @Min(1)
  points: number;

  @IsString()
  reason: string;

  @IsUUID()
  @IsOptional()
  saleId?: string;
}
