import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateSuspensionPeriodDto {
  @ApiProperty({
    description: 'ID of the suspension period',
    required: false,
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Start date of the suspension period',
    example: '2025-03-10T00:00:00.000Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({
    description: 'End date of the suspension period',
    example: '2025-03-15T23:59:59.999Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({
    description: 'Reason for the suspension period',
    example: 'System maintenance',
    required: false,
  })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiProperty({
    description: 'Whether the suspension period is active',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
