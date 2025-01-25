import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '../enums/payment-method.enum';

export type AdvanceDocument = Advance & Document;

@Schema({ timestamps: true })
export class Advance {
  @ApiProperty({
    description: 'The employee requesting the advance',
    example: '64abc123def4567890ghijk0',
  })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  employee: Types.ObjectId;

  @ApiProperty({
    description: 'Amount requested for the advance in KES',
    example: 5000,
  })
  @Prop({ type: Number, required: true, min: 0 })
  amount: number;

  @ApiProperty({
    description: 'Amount repaid for the advance in KES',
    example: 0,
  })
  @Prop({ type: Number, default: 0 })
  amountRepaid: number;

  @ApiProperty({
    description: 'Amount withdrawn from the approved advance in KES',
    example: 0,
  })
  @Prop({ type: Number, default: 0 })
  amountWithdrawn: number;

  @ApiProperty({
    description: 'Purpose of the advance',
    example: 'Medical expenses',
  })
  @Prop({ type: String, required: true })
  purpose: string;

  @ApiProperty({
    description: 'Total interest charged on the advance in KES',
    example: 500,
  })
  @Prop({ type: Number, default: 0 })
  totalInterest: number;

  @ApiProperty({
    description: 'Status of the advance request',
    example: 'pending',
    enum: ['pending', 'approved', 'declined', 'repaying', 'repaid'],
  })
  @Prop({
    type: String,
    enum: ['pending', 'approved', 'declined', 'repaying', 'repaid'],
    default: 'pending',
  })
  status: string;

  @ApiProperty({
    description: 'The date when the advance was requested',
    example: '2025-01-01',
  })
  @Prop({ type: Date, required: true })
  requestedDate: Date;

  @ApiProperty({
    description: 'The date when the advance was approved (if applicable)',
    example: '2025-01-05',
  })
  @Prop({ type: Date })
  approvedDate?: Date;

  @ApiProperty({
    description: 'The date when the advance was disbursed (if applicable)',
    example: '2025-01-06',
  })
  @Prop({ type: Date })
  disbursedDate?: Date;

  @ApiProperty({
    description: 'The repayment period in months',
    example: 3,
  })
  @Prop({ type: Number, required: true, min: 1 })
  repaymentPeriod: number;

  @ApiProperty({
    description: 'Interest rate for the advance in percentage (e.g., 5%)',
    example: 5,
  })
  @Prop({ type: Number, required: true, min: 0 })
  interestRate: number;

  @ApiProperty({
    description: 'Calculated total repayment amount (principal + interest)',
    example: 5250,
  })
  @Prop({ type: Number, required: true, min: 0 })
  totalRepayment: number;

  @ApiProperty({
    description: 'Installment amount per repayment period',
    example: 1750,
  })
  @Prop({ type: Number, required: true, min: 0 })
  installmentAmount: number;

  @ApiProperty({
    description: 'Comments or additional information about the advance',
    example: 'Urgent medical assistance required',
    required: false,
  })
  @Prop({ type: String })
  comments?: string;

  @ApiProperty({
    description: 'Administrator handling the approval (if applicable)',
    example: '64abc123def4567890ghijk1',
  })
  @Prop({ type: Types.ObjectId, ref: 'User' })
  approvedBy?: Types.ObjectId;

  @ApiProperty({
    description: 'Preferred payment method for disbursement',
    example: PaymentMethod.MPESA,
    enum: PaymentMethod,
    default: PaymentMethod.MPESA,
  })
  @Prop({
    type: String,
    enum: PaymentMethod,
    default: PaymentMethod.MPESA,
  })
  preferredPaymentMethod?: PaymentMethod;

  @ApiProperty({
    description: 'Administrator handling the disbursement (if applicable)',
    example: '64abc123def4567890ghijk2',
  })
  @Prop({ type: Types.ObjectId, ref: 'User' })
  disbursedBy?: Types.ObjectId;
}

export const AdvanceSchema = SchemaFactory.createForClass(Advance);
