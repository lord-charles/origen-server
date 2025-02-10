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
        'https://quicksms.advantasms.com/api/services/sendsms/',
        {
          apikey: 'b34872f7e1657c7b12acd9c156f4b409',
          partnerID: '12718',
          message: message,
          shortcode: 'COGNITRON',
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
        'https://quicksms.advantasms.com/api/services/sendsms/',
        {
          apikey: 'b34872f7e1657c7b12acd9c156f4b409',
          partnerID: '12718',
          message: message,
          shortcode: 'COGNITRON',
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

  async sendEmailWithAttachments(
    to: string,
    subject: string,
    message: string,
    attachments: Array<{
      filename: string;
      content: Buffer | string;
    }>,
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
        attachments,
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Email with attachments sent successfully to ${to} - MessageId: ${info.messageId}`,
      );
      return true;
    } catch (error) {
      this.logger.error(`Error sending email with attachments to ${to}: ${error.message}`);
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

    // Create HTML message for sender
    const senderHtmlMessage = `
      <div style="padding: 20px 0;">
        <div style="background-color: #f8fafc; border-left: 4px solid #0891b2; padding: 16px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 16px 0; color: #0891b2;">Transaction Details</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Transaction Type</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right;">${transactionType}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Amount</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right;">KES ${formattedAmount}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Recipient</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right;">${recipientName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">New Balance</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right;">KES ${formattedSenderBalance}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Date</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right;">${getCurrentDate()}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Time</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right;">${getCurrentTime()}</td>
            </tr>
          </table>
        </div>
        <p style="color: #64748b; font-size: 14px;">For any queries, please contact our support team.</p>
      </div>
    `;

    // Create HTML message for recipient
    const recipientHtmlMessage = `
      <div style="padding: 20px 0;">
        <div style="background-color: #f8fafc; border-left: 4px solid #0891b2; padding: 16px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 16px 0; color: #0891b2;">Transaction Details</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Transaction Type</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right;">${transactionType}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Amount Received</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right;">KES ${formattedAmount}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">From</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right;">${senderName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">New Balance</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right;">KES ${formattedRecipientBalance}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Date</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right;">${getCurrentDate()}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Time</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right;">${getCurrentTime()}</td>
            </tr>
          </table>
        </div>
        <p style="color: #64748b; font-size: 14px;">For any queries, please contact our support team.</p>
      </div>
    `;

    // Send SMS notifications
    if (senderPhone) {
      await this.sendSMS(
        senderPhone,
        `Your ${transactionType} transaction of KES ${formattedAmount} to ${recipientName} has been processed successfully. New wallet balance: KES ${formattedSenderBalance}`,
      );
    }

    if (recipientPhone) {
      await this.sendSMS(
        recipientPhone,
        `You have received KES ${formattedAmount} from ${senderName} via Innova ${transactionType}. New wallet balance: KES ${formattedRecipientBalance}`,
      );
    }

    // Send email notifications with HTML template
    if (senderEmail) {
      await this.sendEmail(
        senderEmail,
        `${transactionType} Transaction Confirmation`,
        senderHtmlMessage,
      );
    }

    if (recipientEmail) {
      await this.sendEmail(
        recipientEmail,
        `${transactionType} Transaction Notification`,
        recipientHtmlMessage,
      );
    }
  }
}
