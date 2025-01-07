import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class PushToken extends Document {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  token: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const PushTokenSchema = SchemaFactory.createForClass(PushToken);
