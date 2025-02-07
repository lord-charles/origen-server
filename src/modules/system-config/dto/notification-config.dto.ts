import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEmail, IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class NotificationAdminDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiProperty({ enum: ['balance_alert', 'monthly_report'], isArray: true })
  @IsArray()
  @IsEnum(['balance_alert', 'monthly_report'], { each: true })
  notificationTypes: Array<'balance_alert' | 'monthly_report'>;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateNotificationConfigDto {
  @ApiProperty({ type: [NotificationAdminDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotificationAdminDto)
  notificationAdmins: NotificationAdminDto[];

  @ApiProperty()
  @IsNumber()
  balanceThreshold: number;

  @ApiProperty({ enum: ['excel', 'pdf', 'csv'] })
  @IsEnum(['excel', 'pdf', 'csv'])
  reportFormat: 'excel' | 'pdf' | 'csv';

  @ApiProperty()
  @IsNumber()
  reportGenerationDay: number;

  @ApiProperty()
  @IsBoolean()
  enableEmailNotifications: boolean;

  @ApiProperty()
  @IsBoolean()
  enableSMSNotifications: boolean;
}
