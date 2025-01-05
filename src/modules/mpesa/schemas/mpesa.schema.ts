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
  @Prop({ type: Types.ObjectId, ref: 'Employee', required: true })
  employee: Types.ObjectId;

  @ApiProperty({
    description: 'Mpesa transaction type',
    example: 'paybill',
    enum: [
      'paybill',
      'b2c',
    ],
  })
  @Prop({
    type: String,
    enum: [
      'paybill',
      'b2c',
    ],
    required: true,
  })
  transactionType: string;

  @ApiProperty({
    description: 'Amount of the transaction in KES',
    example: 2000,
  })
  @Prop({ type: Number, required: true })
  amount: number;

  @ApiProperty({
    description: 'Phone number involved in the transaction',
    example: '+254712345678',
  })
  @Prop({ type: String, required: true })
  phoneNumber: string;

  @ApiProperty({
    description: 'Account reference for the transaction',
    example: '123456',
  })
  @Prop({ type: String })
  accountReference?: string;

  @ApiProperty({
    description: 'Status of the transaction',
    example: 'completed',
    enum: ['pending', 'completed', 'failed'],
  })
  @Prop({
    type: String,
    enum: ['pending', 'completed', 'failed'],
    required: true,
  })
  status: string;

  @ApiProperty({
    description: 'Checkout request ID for the transaction',
    example: '123456',
  })
  @Prop({ type: String })
  checkoutRequestId?: string;

  @ApiProperty({
    description: 'Merchant request ID for the transaction',
    example: '123456',
  })
  @Prop({ type: String })
  merchantRequestId?: string;

  @ApiProperty({
    description: 'Unique ID for the transaction',
    example: '123456',
  })
  @Prop({ type: String })
  uniqueId?: string;

  @ApiProperty({
    description: 'Occasion for the transaction',
    example: 'Birthday',
  })
  @Prop({ type: String })
  occasion?: string;

  @ApiProperty({
    description: 'Remarks for the transaction',
    example: 'Transaction flagged for review',
  })
  @Prop({ type: String })
  remarks?: string;

  @ApiProperty({
    description: 'Mpesa receipt number for the transaction',
    example: 'LHG34ER5T7',
  })
  @Prop({ type: String })
  mpesaReceiptNumber?: string;

  @ApiProperty({
    description: 'Result code for the transaction',
    example: '0',
  })
  @Prop({ type: String })
  resultCode?: string;

  @ApiProperty({
    description: 'Result description for the transaction',
    example: 'Success',
  })
  @Prop({ type: String })
  resultDesc?: string;
}

export const MpesaTransactionSchema =
  SchemaFactory.createForClass(MpesaTransaction);
