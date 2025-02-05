import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type UserDocument = User & Document;

// Bank Details Schema
class BankDetails {
  @ApiProperty({ description: 'Name of the bank', example: 'Equity Bank' })
  @Prop()
  bankName?: string;

  @ApiProperty({ description: 'Bank account number', example: '1234567890' })
  @Prop()
  accountNumber?: string;

  @ApiProperty({ description: 'Branch code of the bank', example: '123' })
  @Prop()
  branchCode?: string;
}

// Mpesa Payment Details Schema
class MpesaDetails {
  @ApiProperty({
    description: 'Phone number linked to Mpesa',
    example: '+254712345678',
  })
  @Prop()
  phoneNumber?: string;
}

// Emergency Contact Schema
class EmergencyContact {
  @ApiProperty({ description: 'Name of the contact', example: 'John Doe' })
  @Prop({ required: true })
  name: string;

  @ApiProperty({
    description: 'Relationship to the employee',
    example: 'Spouse',
  })
  @Prop({ required: true })
  relationship: string;

  @ApiProperty({
    description: 'Primary phone number',
    example: '+254712345678',
  })
  @Prop({ required: true })
  phoneNumber: string;

  @ApiProperty({
    description: 'Alternative phone number',
    example: '+254723456789',
  })
  @Prop()
  alternativePhoneNumber?: string;
}

// User Schema
@Schema({ timestamps: true })
export class User {
  @ApiProperty({ description: 'Employee first name', example: 'Jane' })
  @Prop({ required: true })
  firstName: string;

  @ApiProperty({ description: 'Employee last name', example: 'Wanjiku' })
  @Prop({ required: true })
  lastName: string;

  @ApiProperty({
    description: 'Employee email address',
    example: 'jane.wanjiku@company.com',
  })
  @Prop({ required: true, unique: true, index: true })
  email: string;

  @ApiProperty({
    description: 'Phone number for Mpesa transactions',
    example: '+254712345678',
  })
  @Prop({ required: true, unique: true, index: true })
  phoneNumber: string;

  @ApiProperty({
    description: 'National ID of the employee',
    example: '23456789',
  })
  @Prop({ required: true, unique: true })
  nationalId: string;

  @ApiProperty({ description: '4-digit authentication PIN', example: '1234' })
  @Prop({ required: true })
  pin: string;

  @ApiProperty({ description: 'Wallet balance in KES', example: 1500.75 })
  @Prop({ type: Number, default: 0 })
  walletBalance: number;

  @ApiProperty({
    description: 'Cumulative total advances in KES',
    example: 5000.0,
  })
  @Prop({ type: Number, default: 0 })
  totalAdvances: number;

  @ApiProperty({
    description: 'Cumulative total loans in KES',
    example: 20000.0,
  })
  @Prop({ type: Number, default: 0 })
  totalLoans: number;

  @ApiProperty({
    description: 'Status of the employee account',
    example: 'active',
    enum: ['active', 'inactive', 'suspended', 'terminated'],
  })
  @Prop({ type: String, default: 'active' })
  status: string;

  @ApiProperty({ description: 'Employee date of birth', example: '1990-01-15' })
  @Prop({ required: false })
  dateOfBirth?: Date;

  @ApiProperty({ description: 'Bank payment details (if applicable)' })
  @Prop({ type: BankDetails })
  bankDetails?: BankDetails;

  @ApiProperty({ description: 'Mpesa payment details (if applicable)' })
  @Prop({ type: MpesaDetails })
  mpesaDetails?: MpesaDetails;

  @ApiProperty({
    description: 'Payment method used by the employee',
    example: 'bank',
    enum: ['bank', 'mpesa', 'cash', 'wallet'],
  })
  @Prop({ required: false })
  paymentMethod?: 'bank' | 'mpesa' | 'cash' | 'wallet';

  @ApiProperty({
    description: 'Roles assigned in the app',
    example: ['employee'],
  })
  @Prop({
    type: [String],
    default: ['employee'],
    enum: ['employee', 'admin', 'hr', 'finance'],
  })
  roles: string[];

  @ApiProperty({
    description: 'Employee ID or staff number',
    example: 'EMP2024001',
  })
  @Prop({ required: false, unique: true })
  employeeId?: string;

  @ApiProperty({
    description: 'Department the employee belongs to',
    example: 'Engineering',
  })
  @Prop({ required: true })
  department: string;

  @ApiProperty({
    description: 'Job title or position',
    example: 'Senior Software Engineer',
  })
  @Prop({ required: true })
  position: string;

  @ApiProperty({ description: 'Base monthly salary in KES', example: 150000 })
  @Prop({ required: true, type: Number })
  baseSalary: number;

  @ApiProperty({ description: 'Employment start date', example: '2024-01-15' })
  @Prop({ required: true })
  employmentStartDate: Date;

  @ApiProperty({
    description: 'Employment end date (if applicable)',
    example: '2024-12-31',
  })
  @Prop()
  employmentEndDate?: Date;

  @ApiProperty({
    description: 'Type of employment',
    example: 'full-time',
    enum: ['full-time', 'part-time', 'contract', 'intern'],
  })
  @Prop({ required: true })
  employmentType: string;

  @ApiProperty({ description: 'Monthly NHIF deduction in KES', example: 1700 })
  @Prop({ type: Number, required: false })
  nhifDeduction?: number;

  @ApiProperty({ description: 'Monthly NSSF deduction in KES', example: 200 })
  @Prop({ type: Number, required: false })
  nssfDeduction?: number;

  @ApiProperty({ description: 'Emergency contact details' })
  @Prop({ required: false, type: EmergencyContact })
  emergencyContact?: EmergencyContact;

  @ApiProperty({
    description: 'List of all advance applications made by the employee',
    example: ['64abc123def4567890ghijk1', '64abc123def4567890ghijk2'],
  })
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Advance' }] })
  advances?: Types.ObjectId[];

  @ApiProperty({
    description: 'List of all loan applications made by the employee',
    example: ['64abc123def4567890ghijk3', '64abc123def4567890ghijk4'],
  })
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Loan' }] })
  loans?: Types.ObjectId[];

  @ApiProperty({
    description: 'List of all Mpesa transactions linked to the employee',
    example: ['64abc123def4567890ghijk5', '64abc123def4567890ghijk6'],
  })
  @Prop({ type: [{ type: Types.ObjectId, ref: 'MpesaTransaction' }] })
  mpesaTransactions?: Types.ObjectId[];

  @ApiProperty({
    description: 'List of all wallet transactions linked to the employee',
    example: ['64abc123def4567890ghijk5', '64abc123def4567890ghijk6'],
  })
  @Prop({ type: [{ type: Types.ObjectId, ref: 'WalletTransaction' }] })
  walletTransactions?: Types.ObjectId[];
}

export const UserSchema = SchemaFactory.createForClass(User);

@Schema({ _id: false, timestamps: true })
export class Counter {
  @ApiProperty({ required: true })
  @Prop({ required: true })
  name: string;

  @ApiProperty({ required: true, default: 0 })
  @Prop({ required: true, default: 0 })
  sequenceValue: number;
}

export const CounterSchema = SchemaFactory.createForClass(Counter);

UserSchema.pre<UserDocument>('save', async function (next) {
  if (!this.employeeId) {
    const counter = await this.db
      .model('Counter', CounterSchema)
      .findOneAndUpdate(
        { name: 'employeeId' },
        { $inc: { sequenceValue: 1 } },
        { new: true, upsert: true },
      );
    this.employeeId = `EMP-${counter.sequenceValue
      .toString()
      .padStart(3, '0')}`;
  }
  next();
});
