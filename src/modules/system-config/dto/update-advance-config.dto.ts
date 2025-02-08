import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min, Max } from 'class-validator';

export class UpdateAdvanceConfigDto {
  @ApiProperty({
    description: 'Default interest rate for advances',
    example: 12,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  advanceDefaultInterestRate?: number;

  @ApiProperty({
    description: 'Minimum amount allowed for advances',
    example: 5000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  advanceMinAmount?: number;

  @ApiProperty({
    description: 'Maximum amount allowed for advances',
    example: 50000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  advanceMaxAmount?: number;

  @ApiProperty({
    description: 'Minimum repayment period in months',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  advanceMinRepaymentPeriod?: number;

  @ApiProperty({
    description: 'Maximum repayment period in months',
    example: 12,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  advanceMaxRepaymentPeriod?: number;

  @ApiProperty({
    description: 'Maximum percentage of salary that can be advanced',
    example: 50,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  maxAdvancePercentage?: number;

  @ApiProperty({
    description: 'Maximum number of active advances allowed',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxActiveAdvances?: number;
}
