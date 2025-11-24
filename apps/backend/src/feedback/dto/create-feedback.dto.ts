import { IsString, IsInt, Min, Max, IsUUID, IsOptional } from 'class-validator';

export class CreateFeedbackDto {
  @IsUUID()
  customerId: string;

  @IsUUID()
  @IsOptional()
  saleId?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsUUID()
  @IsOptional()
  branchId?: string;
}
