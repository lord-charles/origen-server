import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  Req,
  HttpStatus,
  HttpCode,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { UpdateNotificationConfigDto } from '../dto/notification-config.dto';
import { UpdateNotificationSettingsDto } from '../dto/notification-settings.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Request } from 'express';
import { NotificationConfigService } from '../services/notification-config.service';
import { NotificationAdminDto } from '../dto/notification-config.dto';

@ApiTags('System Notification Configuration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('system-config/notification')
export class NotificationConfigController {
  constructor(
    private readonly systemConfigService: NotificationConfigService,
  ) {}

  @Get()
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get notification configuration' })
  @ApiResponse({
    status: 200,
    description: 'Notification configuration retrieved successfully',
  })
  async getNotificationConfig() {
    return this.systemConfigService.getNotificationConfig();
  }

  @Get('admins')
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all notification admins' })
  @ApiResponse({
    status: 200,
    description: 'Notification admins retrieved successfully',
  })
  async getNotificationAdmins() {
    return this.systemConfigService.getNotificationAdmins();
  }

  @Get('admins/:email')
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get notification admin by email' })
  @ApiParam({ name: 'email', description: 'Admin email address' })
  @ApiResponse({
    status: 200,
    description: 'Notification admin retrieved successfully',
  })
  async getNotificationAdmin(@Param('email') email: string) {
    return this.systemConfigService.getNotificationAdminByEmail(email);
  }

  @Post('admins')
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add new notification admin' })
  @ApiResponse({
    status: 201,
    description: 'Notification admin added successfully',
  })
  async addNotificationAdmin(
    @Body() adminDto: NotificationAdminDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as any)._id;
    return this.systemConfigService.addNotificationAdmin(adminDto, userId);
  }

  @Patch('admins/:email')
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update notification admin' })
  @ApiParam({ name: 'email', description: 'Admin email address' })
  @ApiResponse({
    status: 200,
    description: 'Notification admin updated successfully',
  })
  async updateNotificationAdmin(
    @Param('email') email: string,
    @Body() adminDto: NotificationAdminDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as any)._id;
    return this.systemConfigService.updateNotificationAdmin(
      email,
      adminDto,
      userId,
    );
  }

  @Delete('admins/:email')
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove notification admin' })
  @ApiParam({ name: 'email', description: 'Admin email address' })
  @ApiResponse({
    status: 200,
    description: 'Notification admin removed successfully',
  })
  async removeNotificationAdmin(
    @Param('email') email: string,
    @Req() req: Request,
  ) {
    const userId = (req.user as any)._id;
    return this.systemConfigService.removeNotificationAdmin(email, userId);
  }

  @Patch()
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update notification configuration' })
  @ApiResponse({
    status: 200,
    description: 'Notification configuration updated successfully',
  })
  async updateNotificationConfig(
    @Body() updateDto: UpdateNotificationConfigDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as any)._id;
    return this.systemConfigService.updateNotificationConfig({
      type: 'notification',
      key: 'notification_config',
      data: updateDto,
      updatedBy: userId,
    });
  }

  @Post()
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create notification configuration' })
  @ApiResponse({
    status: 201,
    description: 'Notification configuration created successfully',
  })
  async createNotificationConfig(
    @Body() createDto: UpdateNotificationConfigDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as any)._id;
    return this.systemConfigService.create({
      type: 'notification',
      key: 'notification_config',
      data: createDto,
      createdBy: userId,
    });
  }

  @Patch('settings')
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update notification settings' })
  @ApiResponse({
    status: 200,
    description: 'Notification settings updated successfully',
  })
  async updateNotificationSettings(
    @Body() updateDto: UpdateNotificationSettingsDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as any)._id;
    return this.systemConfigService.updateNotificationSettings(updateDto, userId);
  }

  @Get('settings')
  @Roles('admin', 'hr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get notification settings' })
  @ApiResponse({
    status: 200,
    description: 'Notification settings retrieved successfully',
  })
  async getNotificationSettings() {
    return this.systemConfigService.getNotificationSettings();
  }
}
