import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type SystemConfigDocument = SystemConfig & Document;

@Schema({ timestamps: true })
export class SystemConfig {
  @ApiProperty({
    description: 'Unique key for the configuration',
    example: 'loan_config',
  })
  @Prop({ required: true, unique: true })
  key: string;

  @ApiProperty({
    description: 'Configuration type',
    example: 'loan',
    enum: ['loan', 'wallet', 'mpesa', 'advance', 'notification'],
  })
  @Prop({
    required: true,
    enum: ['loan', 'wallet', 'mpesa', 'advance', 'notification'],
  })
  type: string;

  @ApiProperty({
    description: 'Configuration data',
    example: {
      defaultInterestRate: 12,
      minAmount: 5000,
      maxAmount: 500000,
    },
  })
  @Prop({ type: Object, required: true })
  data: {
    // Loan Configurations
    defaultInterestRate?: number;
    minAmount?: number;
    maxAmount?: number;
    minRepaymentPeriod?: number;
    maxRepaymentPeriod?: number;
    purposes?: string[];
    collateralTypes?: string[];

    // Advance Configurations
    advanceDefaultInterestRate?: number;
    advanceMinAmount?: number;
    advanceMaxAmount?: number;
    advanceMinRepaymentPeriod?: number;
    advanceMaxRepaymentPeriod?: number;
    advancePurposes?: string[];
    maxAdvancePercentage?: number; // Percentage of salary
    maxActiveAdvances?: number;

    // Wallet Configurations
    minTransactionAmount?: number;
    maxTransactionAmount?: number;
    dailyTransactionLimit?: number;
    monthlyTransactionLimit?: number;
    transactionFees?: {
      mpesaWithdrawal?: number;
      walletTransfer?: number;
    };

    // M-Pesa Configurations
    paybillNumber?: string;
    b2cShortcode?: string;
    consumerKey?: string;
    consumerSecret?: string;
    b2cMinAmount?: number;
    b2cMaxAmount?: number;
    callbackBaseUrl?: string;
    initiatorName?: string;
    securityCredential?: string;
    accountBalances?: {
      workingAccount?: {
        balance: number;
        currency: string;
        lastUpdated: Date;
      };
      utilityAccount?: {
        balance: number;
        currency: string;
        lastUpdated: Date;
      };
      chargesPaidAccount?: {
        balance: number;
        currency: string;
        lastUpdated: Date;
      };
      merchantAccount?: {
        balance: number;
        currency: string;
        lastUpdated: Date;
      };
      organizationSettlementAccount?: {
        balance: number;
        currency: string;
        lastUpdated: Date;
      };
    };

    // Notification Configurations
    notificationAdmins?: Array<{
      name: string;
      email: string;
      phone: string;
      notificationTypes: Array<'balance_alert' | 'monthly_report' | 'advance_alert'>;
      notes?: string;
    }>;
    balanceThreshold?: number;
    reportFormat?: 'excel' | 'pdf' | 'csv';
    reportGenerationDay?: number; 
    enableEmailNotifications?: boolean;
    enableSMSNotifications?: boolean;
  };

  @ApiProperty({
    description: 'Suspension periods for advances',
    example: [
      {
        _id: '67a6118eaf3879c1c3369684',
        startDate: '2025-02-10T00:00:00.000Z',
        endDate: '2025-02-15T23:59:59.999Z',
        reason: 'System maintenance',
        isActive: true,
        createdBy: '64abc123def4567890ghijk1',
        updatedBy: '64abc123def4567890ghijk1',
      },
    ],
  })
  @Prop({
    type: [
      {
        _id: { type: Types.ObjectId, auto: true },
        startDate: { type: String, required: true },
        endDate: { type: String, required: true },
        reason: { type: String, required: true },
        isActive: { type: Boolean, default: true },
        createdBy: { type: Types.ObjectId, ref: 'User', required: true },
        updatedBy: { type: Types.ObjectId, ref: 'User', required: true },
      },
    ],
    default: [],
  })
  suspensionPeriods?: {
    _id: Types.ObjectId;
    startDate: string;
    endDate: string;
    reason: string;
    isActive: boolean;
    createdBy?: Types.ObjectId;
    updatedBy?: Types.ObjectId;
  }[];

  @ApiProperty({
    description: 'Whether this configuration is active',
    example: true,
  })
  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @ApiProperty({
    description: 'Description of the configuration',
    example: 'Loan configuration settings',
  })
  @Prop({ type: String })
  description?: string;

  @ApiProperty({
    description: 'Last updated by user ID',
    example: '64abc123def4567890ghijk1',
  })
  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;

  @ApiProperty({
    description: 'Created by user ID',
    example: '64abc123def4567890ghijk1',
  })
  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;
}

export const SystemConfigSchema = SchemaFactory.createForClass(SystemConfig);
