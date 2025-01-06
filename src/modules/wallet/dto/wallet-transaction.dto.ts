import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsEnum,
  Min,
  IsObject,
  ValidateNested,
  IsPhoneNumber,
  MaxLength,
  IsMongoId,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Types } from 'mongoose';

export class RecipientDetailsDto {
  @ApiProperty({
    description: 'Recipient wallet ID for wallet transfers',
    example: '64abc123def4567890ghijk2',
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  recipientWalletId?: Types.ObjectId;

  @ApiProperty({
    description: 'Recipient M-PESA phone number',
    example: '+254712345678',
    required: false,
  })
  @IsOptional()
  @IsPhoneNumber()
  recipientMpesaNumber?: string;
}

export class CreateWalletTransactionDto {
  @ApiProperty({
    description: 'Type of transaction',
    example: 'send_to_mpesa',
    enum: [
      'send_to_mpesa',
      'receive_from_mpesa',
      'transfer_to_wallet',
      'receive_from_advance',
      'withdrawal',
    ],
  })
  @IsNotEmpty()
  @IsEnum([
    'send_to_mpesa',
    'receive_from_mpesa',
    'transfer_to_wallet',
    'receive_from_advance',
    'withdrawal',
  ])
  transactionType: string;

  @ApiProperty({
    description: 'Amount involved in the transaction in KES',
    example: 1500,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({
    description: 'Details of the recipient',
    type: RecipientDetailsDto,
    required: false,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RecipientDetailsDto)
  recipientDetails?: RecipientDetailsDto;

  @ApiProperty({
    description: 'Description or note regarding the transaction',
    example: 'Payment for groceries',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

export class UpdateTransactionStatusDto {
  @ApiProperty({
    description: 'Status of the transaction',
    example: 'completed',
    enum: ['pending', 'completed', 'failed'],
  })
  @IsNotEmpty()
  @IsEnum(['pending', 'completed', 'failed'])
  status: string;

  @ApiProperty({
    description: 'Administrator remarks about the status update',
    example: 'Transaction completed successfully',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminRemarks?: string;
}

export class WalletTransactionFilterDto {
  @ApiProperty({
    description: 'Filter by transaction type',
    enum: [
      'send_to_mpesa',
      'receive_from_mpesa',
      'transfer_to_wallet',
      'receive_from_advance',
      'withdrawal',
    ],
    required: false,
  })
  @IsOptional()
  @IsEnum([
    'send_to_mpesa',
    'receive_from_mpesa',
    'transfer_to_wallet',
    'receive_from_advance',
    'withdrawal',
  ])
  transactionType?: string;

  @ApiProperty({
    description: 'Filter by transaction status',
    enum: ['pending', 'completed', 'failed'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['pending', 'completed', 'failed'])
  status?: string;

  @ApiProperty({
    description: 'Filter by wallet ID',
    example: '64abc123def4567890ghijk0',
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  walletId?: Types.ObjectId;

  @ApiProperty({
    description: 'Minimum amount for filtering',
    example: 1000,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @ApiProperty({
    description: 'Maximum amount for filtering',
    example: 10000,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxAmount?: number;

  @ApiProperty({
    description: 'Start date for filtering',
    example: '2025-01-01',
    required: false,
  })
  @IsOptional()
  @Type(() => Date)
  startDate?: Date;

  @ApiProperty({
    description: 'End date for filtering',
    example: '2025-12-31',
    required: false,
  })
  @IsOptional()
  @Type(() => Date)
  endDate?: Date;

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
