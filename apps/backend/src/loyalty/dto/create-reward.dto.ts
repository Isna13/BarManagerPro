import { IsString, IsInt, Min, IsNumber, IsOptional } from 'class-validator';

export class CreateRewardDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsInt()
  @Min(1)
  pointsRequired: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  value?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  stock?: number;
}
