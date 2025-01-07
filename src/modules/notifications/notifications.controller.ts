import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@Controller('notifications')
@ApiBearerAuth()
@ApiTags('Notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('register-token')
  async registerToken(@Body() body: { userId: string; token: string }) {
    return this.notificationsService.savePushToken(body.userId, body.token);
  }

  @Post('send')
  async sendNotification(
    @Body()
    body: {
      userIds: string[];
      title: string;
      body: string;
      data?: any;
    },
  ) {
    const tokens = await this.notificationsService.getUserPushTokens(
      body.userIds,
    );
    return this.notificationsService.sendPushNotification(
      tokens,
      body.title,
      body.body,
      body.data,
    );
  }
}
