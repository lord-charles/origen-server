import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsDateString, IsBoolean } from 'class-validator';

export class AddSuspensionPeriodDto {
  @ApiProperty({
    description: 'Start date of the suspension period',
    example: '2025-02-10T00:00:00.000Z',
  })
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'End date of the suspension period',
    example: '2025-02-15T23:59:59.999Z',
  })
  @IsNotEmpty()
  @IsDateString()
  endDate: string;

  @ApiProperty({
    description: 'Reason for the suspension period',
    example: 'System maintenance and upgrades',
  })
  @IsNotEmpty()
  @IsString()
  reason: string;

  @ApiProperty({
    description: 'Whether this suspension period is active',
    example: true,
    default: true,
  })
  @IsBoolean()
  isActive: boolean = true;
}

export class UpdateSuspensionPeriodDto extends AddSuspensionPeriodDto {
  @ApiProperty({
    description: 'Index of the suspension period to update',
    example: 0,
  })
  @IsNotEmpty()
  index: number;
}
