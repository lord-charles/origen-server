import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type MpesaTransactionDocument = MpesaTransaction & Document;

@Schema({ timestamps: true })
export class MpesaTransaction {
  @ApiProperty({
    description: 'Creation timestamp',
    example: new Date().toISOString(),
  })
  createdAt?: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: new Date().toISOString(),
  })
  updatedAt?: Date;

  @ApiProperty({
    description: 'ID of the employee associated with the transaction',
    example: '64abc123def4567890ghijk0',
  })
  @Prop({ type: Types.ObjectId, ref: 'Employee', required: true })
  employee: Types.ObjectId;

  @ApiProperty({
    description: 'Type of transaction',
    example: 'paybill',
    enum: ['paybill', 'b2c'],
  })
  @Prop({
    type: String,
    required: true,
    enum: ['paybill', 'b2c'],
  })
  transactionType: string;

  @ApiProperty({
    description: 'Amount of the transaction',
    example: 1000,
  })
  @Prop({ type: Number, required: true })
  amount: number;

  @ApiProperty({
    description: 'Phone number of the customer',
    example: '254712345678',
  })
  @Prop({ type: String, required: true })
  phoneNumber: string;

  @ApiProperty({
    description: 'Account reference for the transaction',
    example: 'INV001',
  })
  @Prop({ type: String })
  accountReference?: string;

  @ApiProperty({
    description: 'Status of the transaction',
    example: 'pending',
    enum: ['pending', 'completed', 'failed'],
  })
  @Prop({
    type: String,
    required: true,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  })
  status: string;

  @ApiProperty({
    description: 'Merchant Request ID from Mpesa',
    example: '486b-4336-91ac-cdd61fd99f3765484483',
  })
  @Prop({ type: String })
  merchantRequestId?: string;

  @ApiProperty({
    description: 'Checkout Request ID from Mpesa',
    example: 'ws_CO_05012025105205632740315545',
  })
  @Prop({ type: String })
  checkoutRequestId?: string;

  @ApiProperty({
    description: 'Response code from Mpesa',
    example: '0',
  })
  @Prop({ type: String })
  responseCode?: string;

  @ApiProperty({
    description: 'Response description from Mpesa',
    example: 'Success. Request accepted for processing',
  })
  @Prop({ type: String })
  responseDescription?: string;

  @ApiProperty({
    description: 'Customer message from Mpesa',
    example: 'Success. Request accepted for processing',
  })
  @Prop({ type: String })
  customerMessage?: string;

  @ApiProperty({
    description: 'Mpesa receipt number',
    example: 'TA591VCQQX',
  })
  @Prop({ type: String })
  mpesaReceiptNumber?: string;

  @ApiProperty({
    description: 'Transaction date from Mpesa',
    example: '20250105111704',
  })
  @Prop({ type: String })
  transactionDate?: string;

  @ApiProperty({
    description: 'Balance after transaction',
    example: '1000',
  })
  @Prop({ type: String })
  balance?: string;

  @ApiProperty({
    description: 'Phone number from callback',
    example: '254740315545',
  })
  @Prop({ type: String })
  callbackPhoneNumber?: string;

  @ApiProperty({
    description: 'Amount confirmed in callback',
    example: 1000,
  })
  @Prop({ type: Number })
  confirmedAmount?: number;

  @ApiProperty({
    description: 'Result code from callback',
    example: '0',
  })
  @Prop({ type: String })
  resultCode?: string;

  @ApiProperty({
    description: 'Result description from callback',
    example: 'The service request is processed successfully.',
  })
  @Prop({ type: String })
  resultDesc?: string;

  @ApiProperty({
    description: 'Callback processing status',
    example: 'processed',
    enum: ['pending', 'processed', 'failed'],
  })
  @Prop({
    type: String,
    enum: ['pending', 'processed', 'failed'],
    default: 'pending',
  })
  callbackStatus?: string;

  // B2C specific fields
  @ApiProperty({
    description: 'Originator Conversation ID for B2C',
    example: '559a-4b4c-b02d-a3bbc8ee159936448751',
  })
  @Prop({ type: String })
  originatorConversationId?: string;

  @ApiProperty({
    description: 'Conversation ID for B2C',
    example: 'AG_20250105_204067852fd5146ff1d0',
  })
  @Prop({ type: String })
  conversationId?: string;

  @ApiProperty({
    description: 'Transaction ID from Mpesa',
    example: 'TA551Z3O1L',
  })
  @Prop({ type: String })
  transactionId?: string;

  @ApiProperty({
    description: 'Receiver party public name',
    example: '0740315545 - Charles Mihunyo Mwaniki',
  })
  @Prop({ type: String })
  receiverPartyPublicName?: string;

  @ApiProperty({
    description: 'Transaction completed date time',
    example: '05.01.2025 11:47:57',
  })
  @Prop({ type: String })
  transactionCompletedDateTime?: string;

  @ApiProperty({
    description: 'B2C utility account available funds',
    example: 54654,
  })
  @Prop({ type: Number })
  b2cUtilityAccountFunds?: number;

  @ApiProperty({
    description: 'B2C working account available funds',
    example: 0,
  })
  @Prop({ type: Number })
  b2cWorkingAccountFunds?: number;

  @ApiProperty({
    description: 'B2C charges paid account available funds',
    example: 0,
  })
  @Prop({ type: Number })
  b2cChargesPaidAccountFunds?: number;

  @ApiProperty({
    description: 'Whether B2C recipient is registered customer',
    example: 'Y',
  })
  @Prop({ type: String })
  b2cRecipientIsRegistered?: string;
}

export const MpesaTransactionSchema =
  SchemaFactory.createForClass(MpesaTransaction);

// Add compound index for merchant and checkout request IDs
MpesaTransactionSchema.index(
  { merchantRequestId: 1, checkoutRequestId: 1 },
  { sparse: true }
);

// Add index for employee lookup
MpesaTransactionSchema.index({ employee: 1 });

// Add index for status queries
MpesaTransactionSchema.index({ status: 1 });

// Add index for phone number
MpesaTransactionSchema.index({ phoneNumber: 1 });
