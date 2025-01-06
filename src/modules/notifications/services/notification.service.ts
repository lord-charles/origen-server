import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendSMS(phoneNumber: string, message: string): Promise<boolean> {
    try {
      const response = await axios.post(
        'https://sms.savvybulksms.com/api/services/sendsms/',
        {
          apikey: '0c53f737571fcf0eb3b60a8a9bcbfd83',
          partnerID: '8816',
          message: message,
          shortcode: 'Savvy_sms',
          mobile: phoneNumber,
        },
      );

      if (response.status === 200) {
        this.logger.log(`SMS sent successfully to ${phoneNumber}`);
        return true;
      }

      this.logger.error(`Failed to send SMS to ${phoneNumber}`);
      return false;
    } catch (error) {
      this.logger.error(
        `Error sending SMS to ${phoneNumber}: ${error.message}`,
      );
      return false;
    }
  }

  async sendTransactionNotification(
    senderPhone: string,
    recipientPhone: string,
    amount: number,
    transactionType: string,
  ): Promise<void> {
    // Format amount to 2 decimal places
    const formattedAmount = amount.toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    // Send notification to sender
    const senderMessage = `Your ${transactionType} transaction of KES ${formattedAmount} has been processed successfully. Thank you for using our service.`;
    await this.sendSMS(senderPhone, senderMessage);

    // Send notification to recipient
    const recipientMessage = `You have received KES ${formattedAmount} via ${transactionType}. Thank you for using our service.`;
    await this.sendSMS(recipientPhone, recipientMessage);
  }
}
