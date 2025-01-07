import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';

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
  @ApiOperation({
    summary: 'Send push notification',
    description: 'Send push notifications to specified users',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['userIds', 'title', 'body'],
      properties: {
        userIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of user IDs to send notification to',
        },
        title: {
          type: 'string',
          description: 'Title of the notification',
        },
        body: {
          type: 'string',
          description: 'Body content of the notification',
        },
        data: {
          type: 'object',
          description: 'Optional additional data to send with notification',
          example: { type: 'message', id: '123' },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Notification sent successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            recipients: { type: 'number' },
          },
        },
      },
    },
  })
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
