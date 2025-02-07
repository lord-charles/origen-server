import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';
import { createObjectCsvWriter } from 'csv-writer';
import { Advance } from '../../advance/schemas/advance.schema';
import { SystemConfig } from '../../system-config/schemas/system-config.schema';
import { NotificationService } from '../../notifications/services/notification.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectModel(Advance.name) private advanceModel: Model<Advance>,
    @InjectModel(SystemConfig.name)
    private systemConfigModel: Model<SystemConfig>,
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkAndGenerateMonthlyReport() {
    try {
      const config = await this.getNotificationConfig();
      if (!config?.data?.reportGenerationDay) return;

      const now = new Date();
      if (now.getDate() === config.data.reportGenerationDay) {
        await this.generateAndSendMonthlyReport();
      }
    } catch (error) {
      this.logger.error(
        `Failed to check/generate monthly report: ${error.message}`,
      );
    }
  }

  async generateAndSendMonthlyReport() {
    try {
      const config = await this.getNotificationConfig();
      if (!config?.data) return;

      const reportData = await this.getMonthlyReportData();
      const reportBuffer = await this.generateReport(
        reportData,
        config.data.reportFormat || 'excel',
      );

      // Get admins subscribed to monthly reports
      const admins =
        config.data.notificationAdmins?.filter((admin) =>
          admin.notificationTypes.includes('monthly_report'),
        ) || [];

      for (const admin of admins) {
        if (config.data.enableEmailNotifications) {
          await this.sendReportEmail(
            admin.email,
            reportBuffer,
            config.data.reportFormat || 'excel',
          );
        }

        if (config.data.enableSMSNotifications) {
          await this.sendReportSMS(admin.phone, admin.name);
        }
      }

      this.logger.log(
        `Monthly report generated and sent to ${admins.length} admins`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to generate/send monthly report: ${error.message}`,
      );
      throw error;
    }
  }

  private async getMonthlyReportData() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const advances = await this.advanceModel
      .find({
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
      })
      .populate('employee', 'name email department position')
      .populate('approvedBy', 'name')
      .populate('disbursedBy', 'name')
      .exec();

    return {
      period: `${startOfMonth.toLocaleDateString('en-KE')} - ${endOfMonth.toLocaleDateString('en-KE')}`,
      advances,
      summary: this.calculateSummary(advances),
    };
  }

  private calculateSummary(advances: any[]) {
    return {
      totalAdvances: advances.length,
      totalAmount: advances.reduce((sum, adv) => sum + adv.amount, 0),
      totalRepaid: advances.reduce((sum, adv) => sum + adv.amountRepaid, 0),
      statusBreakdown: this.getStatusBreakdown(advances),
      departmentBreakdown: this.getDepartmentBreakdown(advances),
    };
  }

  private getStatusBreakdown(advances: any[]) {
    const breakdown = {};
    advances.forEach((adv) => {
      breakdown[adv.status] = (breakdown[adv.status] || 0) + 1;
    });
    return breakdown;
  }

  private getDepartmentBreakdown(advances: any[]) {
    const breakdown = {};
    advances.forEach((adv) => {
      const dept = adv.employee?.department || 'Unknown';
      breakdown[dept] = {
        count: (breakdown[dept]?.count || 0) + 1,
        amount: (breakdown[dept]?.amount || 0) + adv.amount,
      };
    });
    return breakdown;
  }

  private async generateReport(
    data: any,
    format: 'excel' | 'pdf' | 'csv',
  ): Promise<Buffer> {
    switch (format) {
      case 'excel':
        return this.generateExcelReport(data);
      case 'pdf':
        return this.generatePDFReport(data);
      case 'csv':
        return this.generateCSVReport(data);
      default:
        return this.generateExcelReport(data);
    }
  }

  private async generateExcelReport(data: any): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Monthly Advance Report');

    // Styling
    worksheet.getColumn(1).width = 20;
    worksheet.getColumn(2).width = 15;
    worksheet.getColumn(3).width = 15;
    worksheet.getColumn(4).width = 20;
    worksheet.getColumn(5).width = 15;

    // Title
    worksheet.mergeCells('A1:E1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `Monthly Advance Report (${data.period})`;
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center' };

    // Summary Section
    worksheet.addRow(['']);
    worksheet.addRow(['Summary']);
    worksheet.addRow(['Total Advances', data.summary.totalAdvances]);
    worksheet.addRow([
      'Total Amount',
      `KES ${data.summary.totalAmount.toLocaleString()}`,
    ]);
    worksheet.addRow([
      'Total Repaid',
      `KES ${data.summary.totalRepaid.toLocaleString()}`,
    ]);

    // Status Breakdown
    worksheet.addRow(['']);
    worksheet.addRow(['Status Breakdown']);
    Object.entries(data.summary.statusBreakdown).forEach(([status, count]) => {
      worksheet.addRow([status, count]);
    });

    // Department Breakdown
    worksheet.addRow(['']);
    worksheet.addRow(['Department Breakdown']);
    worksheet.addRow(['Department', 'Count', 'Total Amount']);
    Object.entries(data.summary.departmentBreakdown).forEach(
      ([dept, info]: [string, any]) => {
        worksheet.addRow([
          dept,
          info.count,
          `KES ${info.amount.toLocaleString()}`,
        ]);
      },
    );

    // Detailed List
    worksheet.addRow(['']);
    worksheet.addRow(['Detailed Advance List']);
    worksheet.addRow([
      'Employee',
      'Amount',
      'Status',
      'Request Date',
      'Department',
    ]);

    data.advances.forEach((advance) => {
      worksheet.addRow([
        advance.employee?.name || 'N/A',
        `KES ${advance.amount.toLocaleString()}`,
        advance.status,
        new Date(advance.requestedDate).toLocaleDateString('en-KE'),
        advance.employee?.department || 'N/A',
      ]);
    });

    return workbook.xlsx.writeBuffer();
  }

  private async generatePDFReport(data: any): Promise<Buffer> {
    return new Promise((resolve) => {
      const chunks = [];
      const doc = new PDFDocument();

      doc.on('data', chunks.push.bind(chunks));
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      // Title
      doc
        .fontSize(16)
        .text(`Monthly Advance Report (${data.period})`, { align: 'center' });
      doc.moveDown();

      // Summary
      doc.fontSize(14).text('Summary');
      doc
        .fontSize(12)
        .text(`Total Advances: ${data.summary.totalAdvances}`)
        .text(`Total Amount: KES ${data.summary.totalAmount.toLocaleString()}`)
        .text(`Total Repaid: KES ${data.summary.totalRepaid.toLocaleString()}`);
      doc.moveDown();

      // Status Breakdown
      doc.fontSize(14).text('Status Breakdown');
      doc.fontSize(12);
      Object.entries(data.summary.statusBreakdown).forEach(
        ([status, count]) => {
          doc.text(`${status}: ${count}`);
        },
      );
      doc.moveDown();

      // Department Breakdown
      doc.fontSize(14).text('Department Breakdown');
      doc.fontSize(12);
      Object.entries(data.summary.departmentBreakdown).forEach(
        ([dept, info]: [string, any]) => {
          doc.text(
            `${dept}: ${info.count} advances, KES ${info.amount.toLocaleString()}`,
          );
        },
      );
      doc.moveDown();

      // Detailed List
      doc.fontSize(14).text('Detailed Advance List');
      doc.fontSize(12);
      data.advances.forEach((advance) => {
        doc
          .text('----------------------------------------')
          .text(`Employee: ${advance.employee?.name || 'N/A'}`)
          .text(`Amount: KES ${advance.amount.toLocaleString()}`)
          .text(`Status: ${advance.status}`)
          .text(
            `Request Date: ${new Date(advance.requestedDate).toLocaleDateString('en-KE')}`,
          )
          .text(`Department: ${advance.employee?.department || 'N/A'}`)
          .moveDown(0.5);
      });

      doc.end();
    });
  }

  private async generateCSVReport(data: any): Promise<Buffer> {
    const records = data.advances.map((advance) => ({
      employee: advance.employee?.name || 'N/A',
      department: advance.employee?.department || 'N/A',
      amount: advance.amount,
      status: advance.status,
      requestDate: new Date(advance.requestedDate).toLocaleDateString('en-KE'),
      repaidAmount: advance.amountRepaid,
    }));

    const csvWriter = createObjectCsvWriter({
      path: 'temp.csv',
      header: [
        { id: 'employee', title: 'Employee' },
        { id: 'department', title: 'Department' },
        { id: 'amount', title: 'Amount' },
        { id: 'status', title: 'Status' },
        { id: 'requestDate', title: 'Request Date' },
        { id: 'repaidAmount', title: 'Repaid Amount' },
      ],
    });

    await csvWriter.writeRecords(records);
    return Buffer.from(
      records.map((r) => Object.values(r).join(',')).join('\n'),
    );
  }

  private async sendReportEmail(
    email: string,
    reportBuffer: Buffer,
    format: string,
  ) {
    const subject = 'Monthly Advance Report';
    const message = this.generateEmailTemplate();

    try {
      await this.notificationService.sendEmail(email, subject, message, [
        {
          filename: `advance_report.${format}`,
          content: reportBuffer,
        },
      ]);
      this.logger.log(`Report email sent to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send report email to ${email}: ${error.message}`,
      );
    }
  }

  private async sendReportSMS(phone: string, name: string) {
    const message = `Dear ${name}, the monthly advance report has been generated and sent to your email. Please check your inbox.`;

    try {
      await this.notificationService.sendSMS(phone, message);
      this.logger.log(`Report SMS notification sent to ${phone}`);
    } catch (error) {
      this.logger.error(
        `Failed to send report SMS to ${phone}: ${error.message}`,
      );
    }
  }

  private generateEmailTemplate(): string {
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
          <h2 style="margin: 0 0 16px 0; color: #0891b2;">Monthly Advance Report</h2>
          
          <div style="margin-bottom: 20px; color: #1e293b;">
            <p>Dear Administrator,</p>
            <p>Please find attached the monthly advance report for your review.</p>
            <p>This report includes:</p>
            <ul>
              <li>Summary of all advances</li>
              <li>Status breakdown</li>
              <li>Department-wise analysis</li>
              <li>Detailed list of all advances</li>
            </ul>
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

  private async getNotificationConfig() {
    return this.systemConfigModel.findOne({
      type: 'notification',
      key: 'notification_config',
      isActive: true,
    });
  }
}
