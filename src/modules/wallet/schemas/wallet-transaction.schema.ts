import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type WalletTransactionDocument = WalletTransaction & Document;

@Schema({ timestamps: true })
export class WalletTransaction {
  @ApiProperty({
    description: 'ID of the wallet associated with this transaction',
    example: '64abc123def4567890ghijk0',
  })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  walletId: Types.ObjectId;

  @ApiProperty({
    description: 'Type of transaction',
    example: 'send_to_mpesa',
    enum: [
      'send_to_mpesa',
      'receive_from_mpesa',
      'transfer_to_wallet',
      'receive_from_advance',
    ],
  })
  @Prop({
    required: true,
    enum: [
      'send_to_mpesa',
      'receive_from_mpesa',
      'transfer_to_wallet',
      'receive_from_advance',
    ],
  })
  transactionType: string;

  @ApiProperty({
    description: 'Amount involved in the transaction in KES',
    example: 1500,
  })
  @Prop({ required: true, type: Number, min: 0 })
  amount: number;

  @ApiProperty({
    description: 'Transaction ID for reference (unique identifier)',
    example: 'TRX1234567890',
  })
  @Prop({ required: true, unique: true })
  transactionId: string;

  @ApiProperty({
    description: 'Date and time the transaction occurred',
    example: '2025-01-01T10:30:00Z',
  })
  @Prop({ required: true })
  transactionDate: Date;

  @ApiProperty({
    description: 'Status of the transaction',
    example: 'completed',
    enum: ['pending', 'completed', 'failed'],
  })
  @Prop({
    required: true,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  })
  status: string;

  @ApiProperty({
    description:
      'Details of the recipient in case of send or transfer transactions',
    example: {
      recipientWalletId: '64abc123def4567890ghijk2',
      recipientMpesaNumber: '+254712345678',
    },
    required: false,
  })
  @Prop({
    type: Object,
    default: null,
  })
  recipientDetails?: {
    recipientWalletId?: Types.ObjectId;
    recipientMpesaNumber?: string;
  };

  @ApiProperty({
    description: 'Description or note regarding the transaction',
    example: 'Payment for groceries',
    required: false,
  })
  @Prop({ type: String, maxlength: 255 })
  description?: string;

  @ApiProperty({
    description: 'Administrator remarks or notes regarding the transaction',
    example: 'Transaction flagged for review',
    required: false,
  })
  @Prop({ type: String, maxlength: 500 })
  adminRemarks?: string;
}

export const WalletTransactionSchema =
  SchemaFactory.createForClass(WalletTransaction);
