import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SystemConfig } from '../schemas/system-config.schema';

@Injectable()
export class UpdateSuspensionPeriodsMigration {
  constructor(
    @InjectModel(SystemConfig.name)
    private systemConfigModel: Model<SystemConfig>,
  ) {}

  async migrate() {
    const configs = await this.systemConfigModel.find({
      'suspensionPeriods.0': { $exists: true },
    });

    for (const config of configs) {
      if (config.suspensionPeriods && config.suspensionPeriods.length > 0) {
        config.suspensionPeriods = config.suspensionPeriods.map((period) => ({
          ...period,
          createdBy: config.createdBy || period.createdBy,
          updatedBy: config.updatedBy || period.updatedBy,
        }));
        await config.save();
      }
    }
  }
}
