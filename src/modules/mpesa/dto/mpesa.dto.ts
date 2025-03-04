import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsEnum,
  IsDateString,
  IsNumber,
  MaxLength,
  Min,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Types } from 'mongoose';
import { Type } from 'class-transformer';
import { IsValidTransactionDetails } from '../decorators/transaction-validation.decorator';

export enum TransactionType {
  PAYBILL = 'paybill',
  TILL = 'till',
  SEND_MONEY = 'send_money',
  WITHDRAW = 'withdraw',
  DEPOSIT = 'deposit',
  BUY_AIRTIME = 'buy_airtime',
  RECHARGE = 'recharge',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export class RecipientDetailsDto {
  @ApiProperty({
    description: 'Name of the recipient',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Recipient name must be a string' })
  recipientName?: string;

  @ApiProperty({
    description: 'Account number for paybill transactions',
    example: '123456',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Account number must be a string' })
  accountNumber?: string;

  @ApiProperty({
    description: 'Till number for till transactions',
    example: '54321',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Till number must be a string' })
  tillNumber?: string;

  @ApiProperty({
    description: 'Paybill number for paybill transactions',
    example: '67890',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Paybill number must be a string' })
  paybillNumber?: string;
}

export class CreateMpesaTransactionDto {
  @ApiProperty({
    description: 'ID of the employee associated with the transaction',
    example: '64abc123def4567890ghijk0',
  })
  @IsNotEmpty({ message: 'Employee ID is required' })
  @IsString({ message: 'Employee ID must be a string' })
  employee: Types.ObjectId;

  @ApiProperty({
    description: 'Mpesa transaction type',
    example: TransactionType.PAYBILL,
    enum: TransactionType,
  })
  @IsNotEmpty({ message: 'Transaction type is required' })
  @IsEnum(TransactionType, {
    message: `Transaction type must be one of: ${Object.values(TransactionType).join(', ')}`,
  })
  transactionType: TransactionType;

  @ApiProperty({
    description: 'Amount of the transaction in KES',
    example: 2000,
    minimum: 1,
  })
  @IsNotEmpty({ message: 'Amount is required' })
  @IsPositive({ message: 'Amount must be a positive number' })
  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(1, { message: 'Amount must be at least 1 KES' })
  amount: number;

  @ApiProperty({
    description: 'Mpesa transaction ID (unique reference number)',
    example: 'LHG34ER5T7',
  })
  @IsNotEmpty({ message: 'Transaction ID is required' })
  @IsString({ message: 'Transaction ID must be a string' })
  transactionId: string;

  @ApiProperty({
    description:
      'Recipient details for send money or paybill/till transactions',
    type: RecipientDetailsDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecipientDetailsDto)
  @IsValidTransactionDetails({
    message: 'Invalid recipient details for the selected transaction type',
  })
  recipientDetails?: RecipientDetailsDto;

  @ApiProperty({
    description: 'Description or purpose of the transaction',
    example: 'Payment for electricity bill',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MaxLength(255, { message: 'Description cannot exceed 255 characters' })
  description: string;

  @ApiProperty({
    description: 'Status of the transaction',
    example: TransactionStatus.COMPLETED,
    enum: TransactionStatus,
  })
  @IsNotEmpty({ message: 'Status is required' })
  @IsEnum(TransactionStatus, {
    message: `Status must be one of: ${Object.values(TransactionStatus).join(', ')}`,
  })
  status: TransactionStatus;

  @ApiProperty({
    description: 'Phone number involved in the transaction',
    example: '+254712345678',
    pattern: '^\\+254\\d{9}$',
  })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString({ message: 'Phone number must be a string' })
  @Matches(/^\+254\d{9}$/, {
    message: 'Phone number must be in the format +254XXXXXXXXX',
  })
  phoneNumber: string;

  @ApiProperty({
    description: 'Date and time the transaction was initiated',
    example: '2025-01-01T10:30:00Z',
  })
  @IsNotEmpty({ message: 'Transaction date is required' })
  @IsDateString(
    {},
    { message: 'Transaction date must be a valid ISO 8601 date' },
  )
  transactionDate: string;

  @ApiProperty({
    description: 'Additional charges applied to the transaction',
    example: 30,
    required: false,
  })
  @IsOptional()
  @IsPositive({ message: 'Transaction charges must be a positive number' })
  @IsNumber({}, { message: 'Transaction charges must be a number' })
  transactionCharges?: number;

  @ApiProperty({
    description: 'Administrator notes or remarks regarding the transaction',
    example: 'Transaction flagged for review',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Admin remarks must be a string' })
  @MaxLength(500, { message: 'Admin remarks cannot exceed 500 characters' })
  adminRemarks?: string;
}

export class MpesaTransactionDto extends PartialType(
  CreateMpesaTransactionDto,
) {}
