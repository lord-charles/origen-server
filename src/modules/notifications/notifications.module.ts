import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PushToken, PushTokenSchema } from './schemas/push-token.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PushToken.name, schema: PushTokenSchema },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
