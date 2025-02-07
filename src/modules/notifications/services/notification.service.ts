import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as nodemailer from 'nodemailer';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: this.configService.get<string>('SMTP_SERVICE'),
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      secure: true, // true for port 465
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendRegistrationPin(
    phoneNumber: string,
    email: string,
    message: string,
  ): Promise<boolean> {
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
      this.sendEmail(email, `Innova Pin`, message);

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

  async sendEmail(
    to: string,
    subject: string,
    message: string,
  ): Promise<boolean> {
    try {
      // Verify transporter connection
      await this.transporter.verify();

      const mailOptions = {
        from: {
          name: 'Innova App',
          address: this.configService.get<string>('SMTP_USER'),
        },
        to,
        subject,
        text: message,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #2c3e50;">Innova App Notification</h2>
            <div style="padding: 20px; background-color: #f8f9fa; border-radius: 5px;">
              ${message.replace(/\n/g, '<br>')}
            </div>
            <p style="margin-top: 20px; font-size: 12px; color: #666;">
              This is an automated message, please do not reply to this email.
            </p>
          </div>
        `,
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Email sent successfully to ${to} - MessageId: ${info.messageId}`,
      );
      return true;
    } catch (error) {
      this.logger.error(`Error sending email to ${to}: ${error.message}`);
      if (error.code === 'ECONNECTION' || error.code === 'EAUTH') {
        this.logger.error(
          'SMTP connection or authentication error. Please check your SMTP settings.',
        );
      }
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
    senderEmail?: string,
    recipientEmail?: string,
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

    // Prepare notification messages
    const senderMessage = `Your ${transactionType} transaction of KES ${formattedAmount} to ${recipientName} has been processed successfully. New wallet balance: KES ${formattedSenderBalance}. Thank you for using our service.`;
    const recipientMessage = `You have received KES ${formattedAmount} from ${senderName} via Innova ${transactionType}. New wallet balance: KES ${formattedRecipientBalance}. Thank you for using our service.`;

    // Send SMS notifications
    if (senderPhone) {
      await this.sendSMS(senderPhone, senderMessage);
    }

    if (recipientPhone) {
      await this.sendSMS(recipientPhone, recipientMessage);
    }

    // Send email notifications if email addresses are provided
    if (senderEmail) {
      await this.sendEmail(
        senderEmail,
        `${transactionType} Transaction Confirmation`,
        senderMessage,
      );
    }

    if (recipientEmail) {
      await this.sendEmail(
        recipientEmail,
        `${transactionType} Transaction Notification`,
        recipientMessage,
      );
    }
  }
}
