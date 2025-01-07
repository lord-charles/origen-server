import { Injectable, Logger } from '@nestjs/common';
import {
  Expo,
  ExpoPushMessage,
  ExpoPushTicket,
  ExpoPushReceipt,
} from 'expo-server-sdk';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PushToken } from './schemas/push-token.schema';

@Injectable()
export class NotificationsService {
  private expo: Expo;
  private readonly logger = new Logger(NotificationsService.name);
  private readonly CHUNK_SIZE = 100;
  private readonly RECEIPT_RETRY_ATTEMPTS = 3;

  constructor(
    @InjectModel(PushToken.name)
    private pushTokenModel: Model<PushToken>,
  ) {
    this.expo = new Expo();
  }

  async savePushToken(userId: string, token: string) {
    try {
      // Allow development tokens in non-production environment
      const isDevelopment = process.env.NODE_ENV !== 'production';
      const isDevToken = token.startsWith('SIMULATOR-DEV-TOKEN-');
      
      if (!isDevelopment && !Expo.isExpoPushToken(token)) {
        this.logger.error(`Invalid Expo push token: ${token}`);
        throw new Error('Invalid push token format');
      }

      if (isDevelopment && isDevToken) {
        this.logger.warn(`Using development token: ${token}`);
      }

      const existingToken = await this.pushTokenModel.findOne({ userId });

      if (existingToken) {
        existingToken.token = token;
        existingToken.isActive = true;
        return existingToken.save();
      }

      const newToken = new this.pushTokenModel({
        userId,
        token,
        isActive: true
      });

      return newToken.save();
    } catch (error) {
      this.logger.error(`Error saving push token: ${error.message}`);
      throw error;
    }
  }

  async removePushToken(userId: string) {
    try {
      const result = await this.pushTokenModel.findOneAndUpdate(
        { userId },
        { isActive: false },
        { new: true },
      );

      if (!result) {
        this.logger.warn(`No push token found for user: ${userId}`);
      }

      return result;
    } catch (error) {
      this.logger.error(`Error removing push token: ${error.message}`);
      throw error;
    }
  }

  async getUserPushTokens(userIds: string[]): Promise<string[]> {
    try {
      const tokens = await this.pushTokenModel.find({
        userId: { $in: userIds },
        isActive: true,
      });
      return tokens.map((t) => t.token);
    } catch (error) {
      this.logger.error(`Error fetching user push tokens: ${error.message}`);
      throw error;
    }
  }

  private async checkReceipts(tickets: ExpoPushTicket[]) {
    try {
      const receiptIds = tickets
        .filter((ticket) => ticket.status === 'ok' && 'id' in ticket)
        .map((ticket) => (ticket as { id: string }).id);

      if (receiptIds.length === 0) return;

      for (let attempt = 0; attempt < this.RECEIPT_RETRY_ATTEMPTS; attempt++) {
        try {
          const receipts =
            await this.expo.getPushNotificationReceiptsAsync(receiptIds);

          for (const [id, receipt] of Object.entries(receipts)) {
            if (receipt.status === 'error') {
              const { message, details } = receipt;
              this.logger.error(
                `Error with push notification receipt ${id}: ${message}`,
                details,
              );

              if (details?.error === 'DeviceNotRegistered') {
                // Handle token removal for unregistered devices
                const token = await this.pushTokenModel.findOne({
                  token: details.expoPushToken,
                });
                if (token) {
                  await this.removePushToken(token.userId);
                }
              }
            } else if (receipt.status === 'ok') {
              this.logger.log(`Push notification receipt ${id} is ok`);
            }
          }
          break;
        } catch (error) {
          if (attempt === this.RECEIPT_RETRY_ATTEMPTS - 1) {
            throw error;
          }
          await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds before retry
        }
      }
    } catch (error) {
      this.logger.error(`Error checking receipts: ${error.message}`);
    }
  }

  async sendPushNotification(
    tokens: string[],
    title: string,
    body: string,
    data?: any,
  ) {
    try {
      const messages: ExpoPushMessage[] = [];

      for (const token of tokens) {
        if (!Expo.isExpoPushToken(token)) {
          this.logger.warn(`Invalid Expo push token: ${token}`);
          continue;
        }

        messages.push({
          to: token,
          sound: 'default',
          title,
          body,
          data,
          priority: 'high',
          channelId: 'default',
        });
      }

      const chunks = this.expo.chunkPushNotifications(messages);
      const tickets: ExpoPushTicket[] = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          this.logger.error(
            `Error sending push notification chunk: ${error.message}`,
          );
        }
      }

      // Check receipts in background
      this.checkReceipts(tickets).catch((error) => {
        this.logger.error(
          `Error checking push notification receipts: ${error.message}`,
        );
      });

      return {
        success: true,
        sentTo: tokens.length,
      };
    } catch (error) {
      this.logger.error(`Error in sendPushNotification: ${error.message}`);
      throw error;
    }
  }
}
