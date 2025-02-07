import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class GenerateMonthlyReportDto {
  @ApiProperty({
    description: 'Start date for the report period',
    example: '2025-02-01',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({
    description: 'End date for the report period',
    example: '2025-02-28',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}

export class ReportSummaryDto {
  @ApiProperty({
    description: 'Total number of advances in the period',
    example: 25,
  })
  totalAdvances: number;

  @ApiProperty({
    description: 'Total amount of advances in KES',
    example: 250000,
  })
  totalAmount: number;

  @ApiProperty({
    description: 'Total amount repaid in KES',
    example: 150000,
  })
  totalRepaid: number;

  @ApiProperty({
    description: 'Breakdown of advances by status',
    example: {
      pending: 5,
      approved: 10,
      disbursed: 5,
      repaying: 3,
      repaid: 2,
    },
  })
  statusBreakdown: Record<string, number>;

  @ApiProperty({
    description: 'Breakdown of advances by department',
    example: {
      'IT': { count: 5, amount: 50000 },
      'HR': { count: 3, amount: 30000 },
    },
  })
  departmentBreakdown: Record<string, { count: number; amount: number }>;
}
