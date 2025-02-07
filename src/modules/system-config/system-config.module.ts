import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SystemConfigController } from './controllers/system-config.controller';
import { SystemConfigService } from './services/system-config.service';
import {
  SystemConfig,
  SystemConfigSchema,
} from './schemas/system-config.schema';
import { UpdateSuspensionPeriodsMigration } from './migrations/update-suspension-periods';
import { NotificationConfigController } from './controllers/notification-config.controller';
import { NotificationConfigService } from './services/notification-config.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SystemConfig.name, schema: SystemConfigSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [SystemConfigController, NotificationConfigController],
  providers: [
    SystemConfigService,
    UpdateSuspensionPeriodsMigration,
    NotificationConfigService,
  ],
  exports: [SystemConfigService, NotificationConfigService],
})
export class SystemConfigModule {}
