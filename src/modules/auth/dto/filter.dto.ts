import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class UserFilterDto {
  @ApiProperty({
    description: 'Filter by account status',
    enum: ['active', 'inactive', 'suspended', 'terminated'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['active', 'inactive', 'suspended', 'terminated'])
  status?: string;

  @ApiProperty({
    description: 'Filter by department',
    example: 'Engineering',
    required: false,
  })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiProperty({
    description: 'Filter by employment type',
    enum: ['full-time', 'part-time', 'contract', 'intern'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['full-time', 'part-time', 'contract', 'intern'])
  employmentType?: string;

  @ApiProperty({
    description: 'Page number for pagination',
    minimum: 1,
    default: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    minimum: 1,
    default: 10,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;
}
