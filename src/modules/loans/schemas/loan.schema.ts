import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type LoanDocument = Loan & Document;

@Schema({ timestamps: true })
export class Loan {
  @ApiProperty({
    description: 'The employee requesting the loan',
    example: '64abc123def4567890ghijk0',
  })
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  employee: Types.ObjectId;

  @ApiProperty({
    description: 'Amount requested for the loan in KES',
    example: 50000,
  })
  @Prop({ type: Number, required: true, min: 1 })
  amount: number;

  @ApiProperty({
    description: 'Purpose of the loan',
    example: 'Home renovation',
  })
  @Prop({ type: String, required: true })
  purpose: string;

  @ApiProperty({
    description: 'Status of the loan request',
    example: 'pending',
    enum: ['pending', 'approved', 'declined', 'disbursed'],
  })
  @Prop({
    type: String,
    enum: ['pending', 'approved', 'declined', 'disbursed'],
    default: 'pending',
  })
  status: string;

  @ApiProperty({
    description: 'The date when the loan was requested',
    example: '2025-01-01',
  })
  @Prop({ type: Date, required: true })
  requestedDate: Date;

  @ApiProperty({
    description: 'The date when the loan was approved (if applicable)',
    example: '2025-01-10',
  })
  @Prop({ type: Date })
  approvedDate?: Date;

  @ApiProperty({
    description: 'The date when the loan was disbursed (if applicable)',
    example: '2025-01-15',
  })
  @Prop({ type: Date })
  disbursedDate?: Date;

  @ApiProperty({
    description: 'Repayment period in months',
    example: 24,
  })
  @Prop({ type: Number, required: true, min: 1 })
  repaymentPeriod: number;

  @ApiProperty({
    description: 'Interest rate for the loan in percentage (e.g., 12%)',
    example: 12,
  })
  @Prop({ type: Number, required: true, min: 0 })
  interestRate: number;

  @ApiProperty({
    description: 'Calculated total repayment amount (principal + interest)',
    example: 56000,
  })
  @Prop({ type: Number, required: true, min: 0 })
  totalRepayment: number;

  @ApiProperty({
    description: 'Installment amount per repayment period',
    example: 2333.33,
  })
  @Prop({ type: Number, required: true, min: 0 })
  installmentAmount: number;

  @ApiProperty({
    description: 'Collateral details for the loan (if applicable)',
    example: 'Logbook for KAY123A',
  })
  @Prop({ type: String })
  collateral?: string;

  @ApiProperty({
    description: 'Administrator handling the approval (if applicable)',
    example: '64abc123def4567890ghijk1',
  })
  @Prop({ type: Types.ObjectId, ref: 'User' })
  approvedBy?: Types.ObjectId;

  @ApiProperty({
    description: 'Administrator handling the disbursement (if applicable)',
    example: '64abc123def4567890ghijk2',
  })
  @Prop({ type: Types.ObjectId, ref: 'User' })
  disbursedBy?: Types.ObjectId;

  @ApiProperty({
    description: 'Comments or additional information about the loan',
    example: 'Customer requested expedited approval.',
  })
  @Prop({ type: String })
  comments?: string;
}

export const LoanSchema = SchemaFactory.createForClass(Loan);
