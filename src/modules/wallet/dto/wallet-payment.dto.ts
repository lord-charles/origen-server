import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class WalletToWalletDto {
  @ApiProperty({
    description: 'Recipient wallet ID (user _id)',
    example: '64abc123def4567890ghijk0',
  })
  @IsString()
  @IsNotEmpty()
  recipientWalletId: string;

  @ApiProperty({
    description: 'Amount to transfer in KES',
    example: 1000,
  })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({
    description: 'Optional description for the transfer',
    example: 'Payment for services',
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class MpesaToWalletDto {
  @ApiProperty({
    description: 'Phone number in format 254XXXXXXXXX',
    example: '254740315545',
  })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({
    description: 'Amount to transfer in KES',
    example: 1000,
  })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({
    description: 'Recipient wallet ID (user _id)',
    example: '64abc123def4567890ghijk0',
  })
  @IsString()
  @IsNotEmpty()
  recipientWalletId: string;
}

export class WalletToMpesaDto {
  @ApiProperty({
    description: 'Phone number in format 254XXXXXXXXX',
    example: '254740315545',
  })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @ApiProperty({
    description: 'Amount to transfer in KES',
    example: 10,
  })
  @IsNumber()
  @Min(1)
  amount: number;
}

export class SalaryAdvanceToWalletDto {
  @ApiProperty({
    description: 'Amount requested for advance',
    example: 5000,
  })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({
    description: 'Purpose of the advance',
    example: 'Medical expenses',
  })
  @IsString()
  @IsNotEmpty()
  purpose: string;
}
