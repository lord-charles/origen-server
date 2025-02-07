import { Types } from 'mongoose';

export interface SuspensionPeriod {
  startDate: string;
  endDate: string;
  reason: string;
  isActive: boolean;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
}
