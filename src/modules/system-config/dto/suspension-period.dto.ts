import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsDateString,
  IsBoolean,
  IsOptional,
} from 'class-validator';
import { Types } from 'mongoose';

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
    example: 'System maintenance',
  })
  @IsNotEmpty()
  @IsString()
  reason: string;

  @ApiProperty({
    description: 'Whether the suspension period is active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'User ID who created the suspension period',
  })
  @IsOptional()
  createdBy?: Types.ObjectId;

  @ApiProperty({
    description: 'User ID who last updated the suspension period',
  })
  @IsOptional()
  updatedBy?: Types.ObjectId;
}

// export class UpdateSuspensionPeriodDto extends AddSuspensionPeriodDto {
//   @ApiProperty({
//     description: 'Index of the suspension period to update',
//     example: 0,
//   })
//   @IsNotEmpty()
//   index: number;
// }
