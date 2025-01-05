import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsObject, IsBoolean, IsOptional, IsEnum } from 'class-validator';

export enum ConfigType {
  LOAN = 'loan',
  WALLET = 'wallet',
  MPESA = 'mpesa',
  ADVANCE = 'advance',
}

export class CreateSystemConfigDto {
  @ApiProperty({
    description: 'Unique key for the configuration',
    example: 'loan_config',
  })
  @IsString()
  key: string;

  @ApiProperty({
    description: 'Configuration type',
    example: 'loan',
    enum: ConfigType,
  })
  @IsEnum(ConfigType)
  type: ConfigType;

  @ApiProperty({
    description: 'Configuration data object',
    example: {
      defaultInterestRate: 12,
      minAmount: 5000,
      maxAmount: 500000,
    },
  })
  @IsObject()
  data: Record<string, any>;

  @ApiProperty({
    description: 'Whether this configuration is active',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({
    description: 'Description of the configuration',
    example: 'Loan configuration settings',
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateSystemConfigDto {
  @ApiProperty({
    description: 'Configuration data to update',
    example: {
      defaultInterestRate: 14,
      maxAmount: 600000,
    },
  })
  @IsObject()
  @IsOptional()
  data?: Record<string, any>;

  @ApiProperty({
    description: 'Whether this configuration is active',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({
    description: 'Description of the configuration',
    example: 'Updated loan configuration settings',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
