import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, Min } from 'class-validator';

export enum TransactionType {
  // Mpesa Types
  MPESA_PAYBILL = 'paybill',
  MPESA_B2C = 'b2c',

  // Wallet Types
  WALLET_SEND_TO_MPESA = 'send_to_mpesa',
  WALLET_RECEIVE_FROM_MPESA = 'receive_from_mpesa',
  WALLET_TRANSFER = 'transfer_to_wallet',
  WALLET_RECEIVE_ADVANCE = 'receive_from_advance',
  WALLET_WITHDRAWAL = 'withdrawal',

  // Loan Types
  LOAN_DISBURSEMENT = 'loan_disbursement',
  LOAN_REPAYMENT = 'loan_repayment',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  APPROVED = 'approved',
  DECLINED = 'declined',
  DISBURSED = 'disbursed',
}

export class PaginationDto {
  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number = 10;
}
