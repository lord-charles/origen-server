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
        'https://sms.textsms.co.ke/api/services/sendsms/',
        {
          apikey: 'c50496fde7254cad33ff43d3ce5d12cf',
          partnerID: '7848',
          message: message,
          shortcode: 'TextSMS',
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
    senderBalance: number,
    recipientBalance: number,
    senderName: string,
    recipientName: string,
  ): Promise<void> {
    // Format amount to 2 decimal places
    const formattedAmount = amount.toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    // Format balances
    const formattedSenderBalance = senderBalance.toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const formattedRecipientBalance = recipientBalance.toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    // Send notification to sender
    const senderMessage = `Your ${transactionType} transaction of KES ${formattedAmount} to ${recipientName} has been processed successfully. New wallet balance: KES ${formattedSenderBalance}. Thank you for using our service.`;
    await this.sendSMS(senderPhone, senderMessage);

    // Send notification to recipient
    const recipientMessage = `You have received KES ${formattedAmount} from ${senderName} via Innova ${transactionType}. New wallet balance: KES ${formattedRecipientBalance}. Thank you for using our service.`;
    await this.sendSMS(recipientPhone, recipientMessage);
  }
}
