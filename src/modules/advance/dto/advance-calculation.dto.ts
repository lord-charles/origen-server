import { ApiProperty } from '@nestjs/swagger';

export class DailyAdvanceDto {
  @ApiProperty({
    description: 'Date for the advance calculation',
    example: '2025-01-04',
  })
  date: string;

  @ApiProperty({
    description: 'Available advance amount for this day',
    example: 5000,
  })
  availableAmount: number;

  @ApiProperty({
    description: 'Percentage of salary available as advance',
    example: 15.5,
  })
  percentageOfSalary: number;

  @ApiProperty({
    description: 'Whether this day is a weekend',
    example: false,
  })
  isWeekend: boolean;

  @ApiProperty({
    description: 'Whether this day is a holiday',
    example: false,
  })
  isHoliday: boolean;
}

export class MonthlyAdvanceSummaryDto {
  @ApiProperty({
    description: 'Month for the advance summary',
    example: 'January',
  })
  month: string;

  @ApiProperty({
    description: 'Year for the advance summary',
    example: 2025,
  })
  year: number;

  @ApiProperty({
    description: 'Employee basic salary',
    example: 50000,
  })
  basicSalary: number;

  @ApiProperty({
    description: 'Maximum advance percentage allowed',
    example: 50,
  })
  maxAdvancePercentage: number;

  @ApiProperty({
    description: 'Maximum advance amount allowed',
    example: 25000,
  })
  maxAdvanceAmount: number;

  @ApiProperty({
    description: 'Daily advance availability breakdown',
    type: [DailyAdvanceDto],
  })
  dailyAdvances: DailyAdvanceDto[];

  @ApiProperty({
    description: 'Total amount available for advance today',
    example: 15000,
  })
  totalAvailableToday: number;

  @ApiProperty({
    description: 'Previous advances taken this month',
    type: [Object],
  })
  previousAdvances: {
    amount: number;
    date: string;
  }[];
}

export class AdvanceCalculationResponseDto {
  @ApiProperty({
    description: 'Available advance amount',
    example: 15000,
  })
  availableAdvance: number;

  @ApiProperty({
    description: 'Maximum advance amount allowed',
    example: 25000,
  })
  maxAdvance: number;

  @ApiProperty({
    description: 'Employee basic salary',
    example: 50000,
  })
  basicSalary: number;

  @ApiProperty({
    description: 'Current advance percentage of salary',
    example: 30,
  })
  advancePercentage: number;

  @ApiProperty({
    description: 'Total advances taken this month',
    example: 10000,
  })
  previousAdvances: number;

  @ApiProperty({
    description: 'Next salary payment date',
    example: '2025-01-25',
  })
  nextPayday: string;
}
