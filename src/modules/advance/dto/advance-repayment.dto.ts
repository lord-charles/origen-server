import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class AdvanceRepaymentDto {
  @ApiProperty({
    description: 'Phone number in format 254XXXXXXXXX',
    example: '254740315545',
  })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({
    description: 'Amount to repay in KES',
    example: 5000,
  })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({
    description: 'Optional description for the repayment',
    example: 'January 2025 Advance Repayment',
    required: false,
  })
  @IsString()
  description?: string;
}
