import { IsEnum, IsOptional, IsDateString } from 'class-validator';
import { CampaignType, CampaignStatus } from './create-campaign.dto';

export class CampaignQueryDto {
  @IsOptional()
  @IsEnum(CampaignType)
  type?: CampaignType;

  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
