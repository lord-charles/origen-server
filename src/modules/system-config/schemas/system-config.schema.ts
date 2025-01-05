import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
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
    enum: ['loan', 'wallet', 'mpesa', 'advance'],
  })
  @Prop({
    required: true,
    enum: ['loan', 'wallet', 'mpesa', 'advance'],
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
  };

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
  @Prop({ type: String })
  updatedBy?: string;
}

export const SystemConfigSchema = SchemaFactory.createForClass(SystemConfig);
