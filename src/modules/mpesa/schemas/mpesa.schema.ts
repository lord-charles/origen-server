import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type MpesaTransactionDocument = MpesaTransaction & Document;

@Schema({ timestamps: true })
export class MpesaTransaction {
  @ApiProperty({
    description: 'ID of the employee associated with the transaction',
    example: '64abc123def4567890ghijk0',
  })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  employee: Types.ObjectId;

  @ApiProperty({
    description: 'Mpesa transaction type',
    example: 'paybill',
    enum: [
      'paybill',
      'till',
      'send_money',
      'withdraw',
      'deposit',
      'buy_airtime',
    ],
  })
  @Prop({
    type: String,
    enum: [
      'paybill',
      'till',
      'send_money',
      'withdraw',
      'deposit',
      'buy_airtime',
    ],
    required: true,
  })
  transactionType: string;

  @ApiProperty({
    description: 'Amount of the transaction in KES',
    example: 2000,
  })
  @Prop({ type: Number, required: true, min: 0 })
  amount: number;

  @ApiProperty({
    description: 'Mpesa transaction ID (unique reference number)',
    example: 'LHG34ER5T7',
  })
  @Prop({ type: String, required: true, unique: true })
  transactionId: string;

  @ApiProperty({
    description:
      'Recipient details for send money or paybill/till transactions',
    example: {
      recipientName: 'John Doe',
      accountNumber: '123456',
      tillNumber: '54321',
      paybillNumber: '67890',
    },
    required: false,
  })
  @Prop({
    type: {
      recipientName: { type: String },
      accountNumber: { type: String },
      tillNumber: { type: String },
      paybillNumber: { type: String },
    },
  })
  recipientDetails?: {
    recipientName?: string;
    accountNumber?: string;
    tillNumber?: string;
    paybillNumber?: string;
  };

  @ApiProperty({
    description: 'Description or purpose of the transaction',
    example: 'Payment for electricity bill',
  })
  @Prop({ type: String, maxlength: 255 })
  description?: string;

  @ApiProperty({
    description: 'Status of the transaction',
    example: 'completed',
    enum: ['pending', 'completed', 'failed'],
  })
  @Prop({
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  })
  status: string;

  @ApiProperty({
    description: 'Phone number involved in the transaction',
    example: '+254712345678',
  })
  @Prop({ type: String, required: true })
  phoneNumber: string;

  @ApiProperty({
    description: 'Date and time the transaction was initiated',
    example: '2025-01-01T10:30:00Z',
  })
  @Prop({ type: Date, required: true })
  transactionDate: Date;

  @ApiProperty({
    description: 'Additional charges applied to the transaction',
    example: 30,
  })
  @Prop({ type: Number, default: 0 })
  transactionCharges: number;

  @ApiProperty({
    description: 'Administrator notes or remarks regarding the transaction',
    example: 'Transaction flagged for review',
  })
  @Prop({ type: String, maxlength: 500 })
  adminRemarks?: string;
}

export const MpesaTransactionSchema =
  SchemaFactory.createForClass(MpesaTransaction);
