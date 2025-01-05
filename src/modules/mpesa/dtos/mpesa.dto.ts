import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class InitiateC2BDto {
  @ApiProperty({
    description: 'Phone number in format 254XXXXXXXXX',
    example: '254740315545',
  })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({
    description: 'Amount to be paid in KES',
    example: 1,
  })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({
    description: 'Account reference for the transaction',
    example: 'INV001',
  })
  @IsString()
  @IsNotEmpty()
  accountReference: string;
}

export class InitiateB2CDto {
  @ApiProperty({
    description: 'Phone number in format 254XXXXXXXXX',
    example: '254740315545',
  })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({
    description: 'Amount to be paid in KES',
    example: 10,
  })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({
    description: 'Occasion or reason for payment',
    example: 'Salary Payment',
  })
  @IsString()
  occasion?: string;

  @ApiProperty({
    description: 'Additional remarks for the transaction',
    example: 'January 2025 Salary',
  })
  @IsString()
  remarks?: string;
}
