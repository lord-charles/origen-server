import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SystemConfig,
  SystemConfigDocument,
} from '../schemas/system-config.schema';
import { UpdateNotificationConfigDto, NotificationAdminDto } from '../dto/notification-config.dto';
import { NotificationService } from '../../notifications/services/notification.service';
import { UpdateNotificationSettingsDto } from '../dto/notification-settings.dto';

@Injectable()
export class NotificationConfigService {
  private readonly logger = new Logger(NotificationConfigService.name);

  private readonly ADMIN_EMAILS = [
    'mwanikicharles226@gmail.com',
    'michaelgichure@gmail.com',
  ];

  constructor(
    @InjectModel(SystemConfig.name)
    private readonly systemConfigModel: Model<SystemConfigDocument>,
    private readonly notificationService: NotificationService,
  ) {}

  async getNotificationConfig(): Promise<SystemConfigDocument> {
    try {
      const config = await this.systemConfigModel.findOne({
        type: 'notification',
        key: 'notification_config',
        isActive: true,
      });

      if (!config) {
        this.logger.warn('No active notification configuration found');
        throw new NotFoundException(
          'No active notification configuration found',
        );
      }
      return config;
    } catch (error) {
      this.logger.error(`Error fetching notification config: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to fetch notification configuration',
      );
    }
  }

  async getNotificationAdmins(): Promise<NotificationAdminDto[]> {
    try {
      const config = await this.getNotificationConfig();
      return config.data.notificationAdmins || [];
    } catch (error) {
      this.logger.error(`Error fetching notification admins: ${error.message}`);
      throw error;
    }
  }

  async getNotificationAdminByEmail(email: string): Promise<NotificationAdminDto> {
    try {
      const config = await this.getNotificationConfig();
      const admin = config.data.notificationAdmins?.find(
        (admin) => admin.email.toLowerCase() === email.toLowerCase(),
      );

      if (!admin) {
        throw new NotFoundException(`Admin with email ${email} not found`);
      }

      return admin;
    } catch (error) {
      this.logger.error(`Error fetching admin by email: ${error.message}`);
      throw error;
    }
  }

  async addNotificationAdmin(
    adminDto: NotificationAdminDto,
    userId: string,
  ): Promise<SystemConfigDocument> {
    try {
      const config = await this.getNotificationConfig();

      // Check if admin already exists
      const existingAdmin = config.data.notificationAdmins?.find(
        (admin) => admin.email.toLowerCase() === adminDto.email.toLowerCase(),
      );

      if (existingAdmin) {
        throw new ConflictException(
          `Admin with email ${adminDto.email} already exists`,
        );
      }

      // Validate the new admin data
      this.validateNotificationAdmin(adminDto);

      // Add new admin to the list
      const updatedAdmins = [
        ...(config.data.notificationAdmins || []),
        adminDto,
      ];

      const updatedConfig = await this.systemConfigModel.findOneAndUpdate(
        {
          type: 'notification',
          key: 'notification_config',
          isActive: true,
        },
        {
          $set: {
            'data.notificationAdmins': updatedAdmins,
            updatedBy: userId,
          },
        },
        { new: true },
      );

      if (!updatedConfig) {
        throw new NotFoundException('Failed to update notification configuration');
      }

      await this.notifyAdminChange('added', adminDto);
      return updatedConfig;
    } catch (error) {
      this.logger.error(`Error adding notification admin: ${error.message}`);
      throw error;
    }
  }

  async updateNotificationAdmin(
    email: string,
    adminDto: NotificationAdminDto,
    userId: string,
  ): Promise<SystemConfigDocument> {
    try {
      const config = await this.getNotificationConfig();

      // Find admin index
      const adminIndex = config.data.notificationAdmins?.findIndex(
        (admin) => admin.email.toLowerCase() === email.toLowerCase(),
      );

      if (adminIndex === -1) {
        throw new NotFoundException(`Admin with email ${email} not found`);
      }

      // Validate the updated admin data
      this.validateNotificationAdmin(adminDto);

      // Update admin in the list
      const updatedAdmins = [...(config.data.notificationAdmins || [])];
      updatedAdmins[adminIndex] = adminDto;

      const updatedConfig = await this.systemConfigModel.findOneAndUpdate(
        {
          type: 'notification',
          key: 'notification_config',
          isActive: true,
        },
        {
          $set: {
            'data.notificationAdmins': updatedAdmins,
            updatedBy: userId,
          },
        },
        { new: true },
      );

      if (!updatedConfig) {
        throw new NotFoundException('Failed to update notification configuration');
      }

      await this.notifyAdminChange('updated', adminDto);
      return updatedConfig;
    } catch (error) {
      this.logger.error(`Error updating notification admin: ${error.message}`);
      throw error;
    }
  }

  async removeNotificationAdmin(
    email: string,
    userId: string,
  ): Promise<SystemConfigDocument> {
    try {
      const config = await this.getNotificationConfig();

      // Find admin to remove
      const adminToRemove = config.data.notificationAdmins?.find(
        (admin) => admin.email.toLowerCase() === email.toLowerCase(),
      );

      if (!adminToRemove) {
        throw new NotFoundException(`Admin with email ${email} not found`);
      }

      // Remove admin from the list
      const updatedAdmins = config.data.notificationAdmins?.filter(
        (admin) => admin.email.toLowerCase() !== email.toLowerCase(),
      );

      const updatedConfig = await this.systemConfigModel.findOneAndUpdate(
        {
          type: 'notification',
          key: 'notification_config',
          isActive: true,
        },
        {
          $set: {
            'data.notificationAdmins': updatedAdmins,
            updatedBy: userId,
          },
        },
        { new: true },
      );

      if (!updatedConfig) {
        throw new NotFoundException('Failed to update notification configuration');
      }

      await this.notifyAdminChange('removed', adminToRemove);
      return updatedConfig;
    } catch (error) {
      this.logger.error(`Error removing notification admin: ${error.message}`);
      throw error;
    }
  }

  async create(createData: {
    type: string;
    key: string;
    data: UpdateNotificationConfigDto;
    createdBy: string;
  }): Promise<SystemConfigDocument> {
    try {
      // Check if configuration already exists
      const existingConfig = await this.systemConfigModel.findOne({
        type: 'notification',
        key: 'notification_config',
        isActive: true,
      });

      if (existingConfig) {
        this.logger.warn('Active notification configuration already exists');
        throw new BadRequestException(
          'Active notification configuration already exists',
        );
      }

      // Validate notification admin data
      this.validateNotificationAdmins(createData.data.notificationAdmins);

      const config = await this.systemConfigModel.create({
        ...createData,
        isActive: true,
      });

      await this.notifyConfigChange('created', config);
      this.logger.log(
        `Notification configuration created with ID: ${config._id}`,
      );
      return config;
    } catch (error) {
      this.logger.error(`Error creating notification config: ${error.message}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to create notification configuration',
      );
    }
  }

  async updateNotificationConfig(updateData: {
    type: string;
    key: string;
    data: UpdateNotificationConfigDto;
    updatedBy: string;
  }): Promise<SystemConfigDocument> {
    try {
      // Validate notification admin data
      this.validateNotificationAdmins(updateData.data.notificationAdmins);

      const config = await this.systemConfigModel.findOneAndUpdate(
        {
          type: 'notification',
          key: 'notification_config',
          isActive: true,
        },
        {
          $set: {
            data: updateData.data,
            updatedBy: updateData.updatedBy,
          },
        },
        { new: true },
      );

      if (!config) {
        this.logger.warn(
          'No active notification configuration found to update',
        );
        throw new NotFoundException(
          'No active notification configuration found to update',
        );
      }

      await this.notifyConfigChange('updated', config);

      return config;
    } catch (error) {
      this.logger.error(`Error updating notification config: ${error.message}`);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to update notification configuration',
      );
    }
  }

  async getNotificationSettings() {
    try {
      const config = await this.getNotificationConfig();
      const {
        balanceThreshold,
        reportFormat,
        reportGenerationDay,
        enableEmailNotifications,
        enableSMSNotifications,
      } = config.data;

      return {
        balanceThreshold,
        reportFormat,
        reportGenerationDay,
        enableEmailNotifications,
        enableSMSNotifications,
      };
    } catch (error) {
      this.logger.error(`Error fetching notification settings: ${error.message}`);
      throw error;
    }
  }

  async updateNotificationSettings(
    settings: UpdateNotificationSettingsDto,
    userId: string,
  ): Promise<SystemConfigDocument> {
    try {
      const config = await this.getNotificationConfig();

      const updatedConfig = await this.systemConfigModel.findOneAndUpdate(
        {
          type: 'notification',
          key: 'notification_config',
          isActive: true,
        },
        {
          $set: {
            'data.balanceThreshold': settings.balanceThreshold,
            'data.reportFormat': settings.reportFormat,
            'data.reportGenerationDay': settings.reportGenerationDay,
            'data.enableEmailNotifications': settings.enableEmailNotifications,
            'data.enableSMSNotifications': settings.enableSMSNotifications,
            updatedBy: userId,
          },
        },
        { new: true },
      );

      if (!updatedConfig) {
        throw new NotFoundException('Failed to update notification settings');
      }

      await this.notifyConfigChange('updated', updatedConfig);
      return updatedConfig;
    } catch (error) {
      this.logger.error(`Error updating notification settings: ${error.message}`);
      throw error;
    }
  }

  private validateNotificationAdmins(admins: any[]): void {
    if (!Array.isArray(admins)) {
      throw new BadRequestException('Notification admins must be an array');
    }

    admins.forEach((admin, index) => {
      if (!admin.name || typeof admin.name !== 'string') {
        throw new BadRequestException(
          `Invalid name for admin at index ${index}`,
        );
      }
      if (!admin.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin.email)) {
        throw new BadRequestException(
          `Invalid email for admin at index ${index}`,
        );
      }
      if (!admin.phone || !/^\+?[1-9]\d{1,14}$/.test(admin.phone)) {
        throw new BadRequestException(
          `Invalid phone number for admin at index ${index}`,
        );
      }
      if (
        !Array.isArray(admin.notificationTypes) ||
        admin.notificationTypes.length === 0
      ) {
        throw new BadRequestException(
          `Invalid notification types for admin at index ${index}`,
        );
      }
      admin.notificationTypes.forEach((type: string) => {
        if (!['balance_alert', 'monthly_report'].includes(type)) {
          throw new BadRequestException(
            `Invalid notification type '${type}' for admin at index ${index}`,
          );
        }
      });
    });
  }

  private validateNotificationAdmin(admin: NotificationAdminDto): void {
    if (!admin.name || typeof admin.name !== 'string') {
      throw new BadRequestException('Invalid admin name');
    }
    if (!admin.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin.email)) {
      throw new BadRequestException('Invalid admin email');
    }
    if (!admin.phone || !/^\+?[1-9]\d{1,14}$/.test(admin.phone)) {
      throw new BadRequestException('Invalid admin phone number');
    }
    if (
      !Array.isArray(admin.notificationTypes) ||
      admin.notificationTypes.length === 0
    ) {
      throw new BadRequestException('Invalid notification types');
    }
    admin.notificationTypes.forEach((type: string) => {
      if (!['balance_alert', 'monthly_report'].includes(type)) {
        throw new BadRequestException(`Invalid notification type '${type}'`);
      }
    });
  }

  private async notifyConfigChange(
    action: 'created' | 'updated',
    config: SystemConfigDocument,
  ): Promise<void> {
    try {
      const htmlMessage = this.generateConfigChangeEmail(action, config);

      for (const email of this.ADMIN_EMAILS) {
        await this.notificationService.sendEmail(
          email,
          `Notification Configuration ${action.charAt(0).toUpperCase() + action.slice(1)}`,
          htmlMessage,
        );
      }
      this.logger.log(
        `Configuration change notification sent to ${this.ADMIN_EMAILS.join(', ')}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send configuration change notification: ${error.message}`,
        error.stack,
      );
      // Don't throw here as this is a secondary operation
    }
  }

  private async notifyAdminChange(
    action: 'added' | 'updated' | 'removed',
    admin: NotificationAdminDto,
  ): Promise<void> {
    try {
      const subject = `Notification Admin ${action.charAt(0).toUpperCase() + action.slice(1)}`;
      const message = this.generateAdminChangeEmail(action, admin);

      for (const email of this.ADMIN_EMAILS) {
        await this.notificationService.sendEmail(
          email,
          subject,
          message,
        );
      }

      // Also notify the affected admin if they were added or updated
      if (action !== 'removed') {
        const adminMessage = this.generateAdminNotificationEmail(action, admin);
        await this.notificationService.sendEmail(
          admin.email,
          `You've been ${action} as a Notification Admin`,
          adminMessage,
        );
      }

      this.logger.log(
        `Admin change notification sent to ${this.ADMIN_EMAILS.join(', ')} and ${
          action !== 'removed' ? admin.email : 'no admin notification needed'
        }`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send admin change notification: ${error.message}`,
        error.stack,
      );
    }
  }

  private generateConfigChangeEmail(
    action: 'created' | 'updated',
    config: SystemConfigDocument,
  ): string {
    const getCurrentTime = () => {
      return new Date().toLocaleString('en-KE', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Africa/Nairobi',
      });
    };

    const getCurrentDate = () => {
      return new Date().toLocaleDateString('en-KE', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        timeZone: 'Africa/Nairobi',
      });
    };

    const formatAdminList = (admins: any[]) => {
      return admins
        .map(
          (admin) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">
            ${admin.name} (${admin.email})
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">
            ${admin.notificationTypes.join(', ')}
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">
            ${admin.phone}
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">
            ${admin.notes || '-'}
          </td>
        </tr>
      `,
        )
        .join('');
    };

    return `
      <div style="padding: 20px 0;">
        <div style="background-color: #f8fafc; border-left: 4px solid #0891b2; padding: 16px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 16px 0; color: #0891b2;">Notification Configuration ${action.charAt(0).toUpperCase() + action.slice(1)}</h2>
          
          <div style="margin-bottom: 20px;">
            <h3 style="color: #1e293b; margin-bottom: 10px;">Configuration Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Balance Threshold</td>
                <td style="padding: 8px 0; color: #1e293b; text-align: right;">
                  KES ${config.data.balanceThreshold?.toLocaleString() || 'Not set'}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Report Format</td>
                <td style="padding: 8px 0; color: #1e293b; text-align: right;">
                  ${config.data.reportFormat?.toUpperCase() || 'Not set'}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Email Notifications</td>
                <td style="padding: 8px 0; color: #1e293b; text-align: right;">
                  Enabled
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">SMS Notifications</td>
                <td style="padding: 8px 0; color: #1e293b; text-align: right;">
                  ${config.data.enableSMSNotifications ? 'Enabled' : 'Disabled'}
                </td>
              </tr>
            </table>
          </div>

          <div style="margin-bottom: 20px;">
            <h3 style="color: #1e293b; margin-bottom: 10px;">Notification Admins</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr>
                  <th style="text-align: left; padding: 8px; border-bottom: 2px solid #e2e8f0;">Admin</th>
                  <th style="text-align: left; padding: 8px; border-bottom: 2px solid #e2e8f0;">Notification Types</th>
                  <th style="text-align: left; padding: 8px; border-bottom: 2px solid #e2e8f0;">Phone</th>
                  <th style="text-align: left; padding: 8px; border-bottom: 2px solid #e2e8f0;">Notes</th>
                </tr>
              </thead>
              <tbody>
                ${formatAdminList(config.data.notificationAdmins || [])}
              </tbody>
            </table>
          </div>

          <div style="margin-top: 20px; font-size: 14px; color: #64748b;">
            <p>Date: ${getCurrentDate()}</p>
            <p>Time: ${getCurrentTime()}</p>
            <p>Action By: ${config.updatedBy || config.createdBy}</p>
          </div>
        </div>
        
        <p style="color: #64748b; font-size: 14px;">
          This is an automated message. Please do not reply to this email.
        </p>
      </div>
    `;
  }

  private generateAdminChangeEmail(
    action: 'added' | 'updated' | 'removed',
    admin: NotificationAdminDto,
  ): string {
    const getCurrentTime = () => {
      return new Date().toLocaleString('en-KE', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Africa/Nairobi',
      });
    };

    const getCurrentDate = () => {
      return new Date().toLocaleDateString('en-KE', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        timeZone: 'Africa/Nairobi',
      });
    };

    return `
      <div style="padding: 20px 0;">
        <div style="background-color: #f8fafc; border-left: 4px solid #0891b2; padding: 16px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 16px 0; color: #0891b2;">Notification Admin ${
            action.charAt(0).toUpperCase() + action.slice(1)
          }</h2>
          
          <div style="margin-bottom: 20px;">
            <h3 style="color: #1e293b; margin-bottom: 10px;">Admin Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Name</td>
                <td style="padding: 8px 0; color: #1e293b; text-align: right;">
                  ${admin.name}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Email</td>
                <td style="padding: 8px 0; color: #1e293b; text-align: right;">
                  ${admin.email}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Phone</td>
                <td style="padding: 8px 0; color: #1e293b; text-align: right;">
                  ${admin.phone}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Notification Types</td>
                <td style="padding: 8px 0; color: #1e293b; text-align: right;">
                  ${admin.notificationTypes.join(', ')}
                </td>
              </tr>
              ${
                admin.notes
                  ? `
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Notes</td>
                <td style="padding: 8px 0; color: #1e293b; text-align: right;">
                  ${admin.notes}
                </td>
              </tr>
              `
                  : ''
              }
            </table>
          </div>

          <div style="margin-top: 20px; font-size: 14px; color: #64748b;">
            <p>Date: ${getCurrentDate()}</p>
            <p>Time: ${getCurrentTime()}</p>
          </div>
        </div>
        
        <p style="color: #64748b; font-size: 14px;">
          This is an automated message. Please do not reply to this email.
        </p>
      </div>
    `;
  }

  private generateAdminNotificationEmail(
    action: 'added' | 'updated',
    admin: NotificationAdminDto,
  ): string {
    return `
      <div style="padding: 20px 0;">
        <div style="background-color: #f8fafc; border-left: 4px solid #0891b2; padding: 16px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 16px 0; color: #0891b2;">Welcome to the Notification Admin Team</h2>
          
          <div style="margin-bottom: 20px;">
            <p style="color: #1e293b;">
              Dear ${admin.name},
            </p>
            <p style="color: #1e293b;">
              You have been ${action} as a Notification Administrator. You will receive the following types of notifications:
            </p>
            <ul style="color: #1e293b;">
              ${admin.notificationTypes
                .map(
                  (type) => `
                <li>${
                  type === 'balance_alert'
                    ? 'Balance Alerts: Notifications when account balance is below threshold'
                    : 'Monthly Reports: Regular system performance and status reports'
                }</li>
              `,
                )
                .join('')}
            </ul>
            <p style="color: #1e293b;">
              These notifications will be sent to:
            </p>
            <ul style="color: #1e293b;">
              <li>Email: ${admin.email}</li>
              <li>Phone: ${admin.phone}</li>
            </ul>
          </div>

          <div style="margin-top: 20px; font-size: 14px; color: #64748b;">
            <p>If you believe this was done in error, please contact the system administrator.</p>
          </div>
        </div>
        
        <p style="color: #64748b; font-size: 14px;">
          This is an automated message. Please do not reply to this email.
        </p>
      </div>
    `;
  }
}
