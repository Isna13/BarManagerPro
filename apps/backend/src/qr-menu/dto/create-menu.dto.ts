import { IsString, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class CreateMenuDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  branchId: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}
