import { Module } from '@nestjs/common';
import { ReportsService } from './services/reports.service';
import { ReportsController } from './controllers/reports.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Advance, AdvanceSchema } from '../advance/schemas/advance.schema';
import { NotificationService } from '../notifications/services/notification.service';
import { SystemConfig, SystemConfigSchema } from '../system-config/schemas/system-config.schema';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Advance.name, schema: AdvanceSchema },
      { name: SystemConfig.name, schema: SystemConfigSchema },
    ]),
    ScheduleModule.forRoot(),
    ConfigModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, NotificationService],
  exports: [ReportsService],
})
export class ReportsModule {}
