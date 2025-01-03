import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  Min,
  IsEnum,
  IsDate,
  MaxLength,
  IsMongoId,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Types } from 'mongoose';

export class CreateAdvanceDto {
  @ApiProperty({
    description: 'Amount requested for the advance in KES',
    example: 5000,
  })
  @IsNotEmpty({ message: 'Advance amount is required' })
  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(1, { message: 'Amount must be greater than 0' })
  amount: number;

  @ApiProperty({
    description: 'Purpose of the advance',
    example: 'Medical expenses',
  })
  @IsNotEmpty({ message: 'Purpose is required' })
  @IsString({ message: 'Purpose must be a string' })
  @MaxLength(255, { message: 'Purpose cannot exceed 255 characters' })
  purpose: string;

  @ApiProperty({
    description: 'Repayment period in months',
    example: 3,
  })
  @IsNotEmpty({ message: 'Repayment period is required' })
  @IsNumber({}, { message: 'Repayment period must be a number' })
  @Min(1, { message: 'Repayment period must be at least 1 month' })
  repaymentPeriod: number;

  @ApiProperty({
    description: 'Comments or additional information',
    example: 'Urgent medical assistance required',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Comments must be a string' })
  @MaxLength(500, { message: 'Comments cannot exceed 500 characters' })
  comments?: string;
}

export class UpdateAdvanceStatusDto {
  @ApiProperty({
    description: 'Status of the advance request',
    enum: ['pending', 'approved', 'declined', 'disbursed'],
    example: 'approved',
  })
  @IsNotEmpty({ message: 'Status is required' })
  @IsEnum(['pending', 'approved', 'declined', 'disbursed'], {
    message: 'Invalid advance status',
  })
  status: string;

  @ApiProperty({
    description: 'Comments or additional information about the status change',
    example: 'Advance approved based on eligibility',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Comments must be a string' })
  @MaxLength(500, { message: 'Comments cannot exceed 500 characters' })
  comments?: string;
}

export class AdvanceFilterDto {
  @ApiProperty({
    description: 'Filter by advance status',
    enum: ['pending', 'approved', 'declined', 'disbursed'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['pending', 'approved', 'declined', 'disbursed'], {
    message: 'Invalid advance status',
  })
  status?: string;

  @ApiProperty({
    description: 'Filter by employee ID',
    example: '64abc123def4567890ghijk0',
    required: false,
  })
  @IsOptional()
  @IsMongoId({ message: 'Invalid employee ID format' })
  employee?: Types.ObjectId;

  @ApiProperty({
    description: 'Minimum amount for filtering',
    example: 1000,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Minimum amount must be a number' })
  @Min(0, { message: 'Minimum amount cannot be negative' })
  minAmount?: number;

  @ApiProperty({
    description: 'Maximum amount for filtering',
    example: 10000,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Maximum amount must be a number' })
  @Min(0, { message: 'Maximum amount cannot be negative' })
  maxAmount?: number;

  @ApiProperty({
    description: 'Start date for filtering',
    example: '2025-01-01',
    required: false,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Invalid start date' })
  startDate?: Date;

  @ApiProperty({
    description: 'End date for filtering',
    example: '2025-12-31',
    required: false,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Invalid end date' })
  endDate?: Date;

  @ApiProperty({
    description: 'Page number for pagination',
    minimum: 1,
    default: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Page must be a number' })
  @Min(1, { message: 'Page must be greater than 0' })
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    minimum: 1,
    default: 10,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Limit must be a number' })
  @Min(1, { message: 'Limit must be greater than 0' })
  limit?: number = 10;
}
