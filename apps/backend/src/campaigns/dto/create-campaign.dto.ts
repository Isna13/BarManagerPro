import { IsString, IsOptional, IsDateString, IsEnum, IsUUID, IsNumber, Min } from 'class-validator';

export enum CampaignType {
  DISCOUNT = 'DISCOUNT',
  BOGO = 'BOGO', // Buy One Get One
  HAPPY_HOUR = 'HAPPY_HOUR',
  SEASONAL = 'SEASONAL',
  LOYALTY = 'LOYALTY',
}

export enum CampaignStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
}

export class CreateCampaignDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsEnum(CampaignType)
  type: CampaignType;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discountPercentage?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discountAmount?: number;

  @IsUUID()
  @IsOptional()
  branchId?: string;

  @IsString()
  @IsOptional()
  targetProducts?: string; // JSON array of product IDs

  @IsString()
  @IsOptional()
  targetCustomers?: string; // JSON array of customer IDs or segments
}
