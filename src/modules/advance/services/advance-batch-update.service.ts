import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Advance, AdvanceDocument } from '../schemas/advance.schema';
import { NotificationService } from '../../notifications/services/notification.service';
import { UpdateResult } from '../types/advance-batch-update.types';


interface PopulatedAdvance extends Omit<AdvanceDocument, 'employee'> {
  employee: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber?: string;
  } | null;
}

@Injectable()
export class AdvanceBatchUpdateService {
  constructor(
    @InjectModel(Advance.name)
    private readonly advanceModel: Model<AdvanceDocument>,
    private readonly notificationService: NotificationService,
  ) {}

  async updateAdvancesToRepaid(advanceIds: string[]): Promise<UpdateResult> {
    const result: UpdateResult = {
      updated: [],
      failed: [],
    };

    // Process each advance
    for (const id of advanceIds) {
      try {
        const advance = await this.advanceModel
          .findById(id)
          .populate<PopulatedAdvance>('employee', 'firstName lastName email phoneNumber');

        if (!advance) {
          result.failed.push({
            id,
            firstName: '',
            lastName: '',
            email: '',
            reason: 'Advance not found',
          });
          continue;
        }

        if (advance.status !== 'repaying') {
          result.failed.push({
            id,
            firstName: advance.employee?.firstName || '',
            lastName: advance.employee?.lastName || '',
            email: advance.employee?.email || '',
            reason: `Invalid status: ${advance.status}. Only advances in 'repaying' status can be updated`,
          });
          continue;
        }

        // Update advance to repaid status
        const updatedAdvance = await this.advanceModel.findByIdAndUpdate(
          id,
          {
            status: 'repaid',
            amountRepaid: advance.amount,
            repaidDate: new Date(),
          },
          { new: true },
        ).populate<PopulatedAdvance>('employee', 'firstName lastName email phoneNumber');

        if (!updatedAdvance) {
          throw new Error('Failed to update advance');
        }

        result.updated.push({
          id,
          firstName: updatedAdvance.employee?.firstName || '',
          lastName: updatedAdvance.employee?.lastName || '',
          email: updatedAdvance.employee?.email || '',
          amountRepaid: updatedAdvance.amount,
        });

        // Send notifications
        await this.sendRepaidNotification(updatedAdvance);

      } catch (error) {
        result.failed.push({
          id,
          firstName: '',
          lastName: '',
          email: '',
          reason: `Error processing advance: ${error.message}`,
        });
      }
    }

    return result;
  }

  private async sendRepaidNotification(advance: PopulatedAdvance) {
    const formattedAmount = advance.amount.toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    // Send SMS notification
    if (advance.employee?.phoneNumber) {
      const smsMessage = `Your advance of KES ${formattedAmount} applied on ${new Date(advance.createdAt).toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' })} has been marked as fully repaid. Thank you for your timely repayments.`;
      await this.notificationService.sendSMS(advance.employee.phoneNumber, smsMessage);
    }

    // Send email notification
    if (advance.employee?.email) {
      const emailTemplate = this.getRepaidEmailTemplate(advance, formattedAmount);
      await this.notificationService.sendEmail(
        advance.employee.email,
        'Advance Fully Repaid',
        emailTemplate,
      );
    }
  }

  private getRepaidEmailTemplate(advance: PopulatedAdvance, formattedAmount: string): string {
    return `
      <div style="padding: 20px 0;">
        <div style="background-color: #f8fafc; border-left: 4px solid #059669; padding: 16px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 16px 0; color: #059669;">
            Advance Fully Repaid
          </h2>
          <div style="margin-bottom: 16px;">
            <div style="
              display: inline-block;
              background-color: #05966915;
              color: #059669;
              padding: 4px 12px;
              border-radius: 9999px;
              font-size: 14px;
              font-weight: 500;
            ">
              🎉 Repaid
            </div>
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Total Amount</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right;">KES ${formattedAmount}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Application Date</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right;">${new Date(advance.createdAt).toLocaleDateString('en-KE', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Completion Date</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right;">${new Date().toLocaleDateString('en-KE', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}</td>
            </tr>
          </table>
        </div>
        <div style="margin-top: 24px; padding: 16px; background-color: #f0fdf4; border-radius: 4px;">
          <h3 style="margin: 0 0 8px 0; color: #059669;">Congratulations!</h3>
          <p style="margin: 0; color: #075985; font-size: 14px;">
            Your advance has been fully repaid. You may now apply for another advance if needed.
            Thank you for your timely repayments.
          </p>
        </div>
        <p style="color: #64748b; font-size: 14px; margin-top: 24px;">
          For any queries about your advance, please contact our support team.
        </p>
      </div>
    `;
  }
}
