import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, Min, Max } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @ApiProperty({
    description: 'Balance threshold for notifications',
    example: 25000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  balanceThreshold: number;

  @ApiProperty({
    description: 'Report format',
    enum: ['excel', 'pdf', 'csv'],
    example: 'excel',
  })
  @IsEnum(['excel', 'pdf', 'csv'])
  reportFormat: 'excel' | 'pdf' | 'csv';

  @ApiProperty({
    description: 'Day of month for report generation',
    example: 20,
    minimum: 1,
    maximum: 31,
  })
  @IsNumber()
  @Min(1)
  @Max(31)
  reportGenerationDay: number;

  @ApiProperty({
    description: 'Enable email notifications',
    example: true,
  })
  @IsBoolean()
  enableEmailNotifications: boolean;

  @ApiProperty({
    description: 'Enable SMS notifications',
    example: true,
  })
  @IsBoolean()
  enableSMSNotifications: boolean;
}
