import { IsUUID, IsInt, Min, IsString } from 'class-validator';

export class RedeemPointsDto {
  @IsUUID()
  customerId: string;

  @IsInt()
  @Min(1)
  points: number;

  @IsString()
  reward: string;
}
