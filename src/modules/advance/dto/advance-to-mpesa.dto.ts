import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class AdvanceToMpesaDto {
  @ApiProperty({
    description: 'Phone number to receive the advance payment',
    example: '254712345678',
  })
  @IsNotEmpty()
  @IsString()
  phoneNumber: string;

  @ApiProperty({
    description: 'Amount to withdraw from approved advance',
    example: 5000,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  amount: number;
}

export class CheckApprovedAdvanceAmountResponseDto {
  @ApiProperty({
    description: 'Total approved advance amount',
    example: 10000,
  })
  approvedAmount: number;

  @ApiProperty({
    description: 'Amount already withdrawn',
    example: 2000,
  })
  withdrawnAmount: number;

  @ApiProperty({
    description: 'Available amount for withdrawal',
    example: 8000,
  })
  availableAmount: number;
}
