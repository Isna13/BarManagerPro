import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';

export enum NotificationType {
  LOW_STOCK = 'LOW_STOCK',
  OVERDUE_DEBT = 'OVERDUE_DEBT',
  DAILY_SUMMARY = 'DAILY_SUMMARY',
  SALE_COMPLETED = 'SALE_COMPLETED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
}

export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export class CreateNotificationDto {
  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority = NotificationPriority.MEDIUM;

  @IsUUID()
  @IsOptional()
  userId?: string;

  @IsUUID()
  @IsOptional()
  branchId?: string;

  @IsString()
  @IsOptional()
  metadata?: string; // JSON string
}
