import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdvanceController } from './advance.controller';
import { AdvanceService } from './advance.service';
import { Advance, AdvanceSchema } from './schemas/advance.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';
import {
  SystemConfig,
  SystemConfigSchema,
} from '../system-config/schemas/system-config.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Advance.name, schema: AdvanceSchema },
      { name: User.name, schema: UserSchema },
      { name: SystemConfig.name, schema: SystemConfigSchema },
    ]),
  ],
  controllers: [AdvanceController],
  providers: [AdvanceService],
  exports: [AdvanceService],
})
export class AdvanceModule {}
