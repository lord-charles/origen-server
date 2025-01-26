import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type SystemLogDocument = SystemLog & Document;

export enum LogSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
}

@Schema({ timestamps: true })
export class SystemLog {
  @ApiProperty({
    description: 'Timestamp of the log entry',
    example: '2023-07-25T08:30:00Z',
  })
  @Prop({ type: Date, default: Date.now })
  timestamp: Date;

  @ApiProperty({
    description: 'Event type or name',
    example: 'Employee Login',
  })
  @Prop({ required: true })
  event: string;

  @ApiProperty({
    description: 'Detailed description of the event',
    example: 'John Doe logged in successfully',
  })
  @Prop({ required: true })
  details: string;

  @ApiProperty({
    description: 'Severity level of the log',
    enum: LogSeverity,
    example: 'info',
  })
  @Prop({ type: String, enum: LogSeverity, default: LogSeverity.INFO })
  severity: LogSeverity;

  @ApiProperty({
    description: 'Related user ID if applicable',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({ type: String })
  userId?: string;

  @ApiProperty({
    description: 'IP address if applicable',
    example: '192.168.1.100',
  })
  @Prop({ type: String })
  ipAddress?: string;
}

export const SystemLogSchema = SchemaFactory.createForClass(SystemLog);
