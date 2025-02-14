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
import { Buffer } from 'buffer';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { enGB } from 'date-fns/locale';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectModel(Advance.name) private advanceModel: Model<Advance>,
    @InjectModel(SystemConfig.name)
    private systemConfigModel: Model<SystemConfig>,
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
  ) { }

  @Cron(CronExpression.EVERY_DAY_AT_10AM, {
    name: 'check-and-generate-monthly-report',
    timeZone: 'Africa/Nairobi'
  })

  async checkAndGenerateMonthlyReport() {
    try {
      this.logger.debug('Running monthly report check...');
      const config = await this.getNotificationConfig();

      if (!config?.data?.reportGenerationDay) {
        this.logger.debug('Report generation day not configured');
        return;
      }

      const now = new Date();
      this.logger.debug(`Current date: ${now.getDate()}, Report generation day: ${config.data.reportGenerationDay}`);

      if (now.getDate() === config.data.reportGenerationDay) {
        this.logger.log('Starting monthly report generation...');
        await this.generateAndSendMonthlyReport();
      } else {
        this.logger.debug('Not the configured day for report generation');
      }
    } catch (error) {
      this.logger.error(
        `Failed to check/generate monthly report: ${error.message}`,
        error.stack,
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
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const advances = await this.advanceModel
      .find({
        createdAt: { $gte: monthStart, $lte: monthEnd },
      })
      .populate('employee', 'firstName lastName email phoneNumber nationalId employeeId department position')
      .populate('approvedBy', 'firstName lastName employeeId')
      .populate('disbursedBy', 'firstName lastName employeeId')
      .exec();

    return {
      period: `${format(monthStart, 'dd MMM yyyy', { locale: enGB })} - ${format(monthEnd, 'dd MMM yyyy', { locale: enGB })}`,
      advances,
      summary: this.calculateSummary(advances),
    };
  }

  private calculateSummary(advances: any[]) {
    const totalAmount = advances.reduce((sum, adv) => sum + adv.amount, 0);
    const totalRepaid = advances.reduce((sum, adv) => sum + adv.amountRepaid, 0);
    const totalWithdrawn = advances.reduce((sum, adv) => sum + (adv.amountWithdrawn || 0), 0);
    const totalInterest = advances.reduce((sum, adv) => sum + ((adv.amount * adv.interestRate) / 100), 0);

    return {
      totalAdvances: advances.length,
      totalAmount,
      totalRepaid,
      totalWithdrawn,
      totalInterest,
      totalOutstanding: totalAmount - totalRepaid,
      averageAmount: advances.length ? totalAmount / advances.length : 0,
      averageRepaymentPeriod: advances.length ?
        advances.reduce((sum, adv) => sum + adv.repaymentPeriod, 0) / advances.length : 0,
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
    worksheet.properties.defaultRowHeight = 20;

    // Define columns with proper width and styling
    worksheet.columns = [
      { header: 'Employee ID', key: 'empId', width: 15 },
      { header: 'Full Name', key: 'name', width: 25 },
      { header: 'National ID', key: 'nationalId', width: 15 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Phone', key: 'phone', width: 20 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Position', key: 'position', width: 20 },
      { header: 'Purpose', key: 'purpose', width: 25 },
      { header: 'Advance Amount', key: 'amount', width: 15 },
      { header: 'Interest Rate (%)', key: 'interestRate', width: 15 },
      { header: 'Interest Amount', key: 'interestAmount', width: 15 },
      { header: 'Total Repayment', key: 'totalRepayment', width: 15 },
      { header: 'Amount Withdrawn', key: 'amountWithdrawn', width: 15 },
      { header: 'Repaid Amount', key: 'repaidAmount', width: 15 },
      { header: 'Outstanding', key: 'outstanding', width: 15 },
      { header: 'Repayment Period', key: 'repaymentPeriod', width: 15 },
      { header: 'Installment Amount', key: 'installmentAmount', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Request Date', key: 'requestDate', width: 20 },
      { header: 'Approval Date', key: 'approvalDate', width: 20 },
      { header: 'Approved By', key: 'approvedBy', width: 20 },
      { header: 'Disbursed Date', key: 'disbursedDate', width: 20 },
      { header: 'Disbursed By', key: 'disbursedBy', width: 20 },
      { header: 'Payment Method', key: 'paymentMethod', width: 15 },
      { header: 'Comments', key: 'comments', width: 30 },
    ];

    // Title and Report Period
    worksheet.mergeCells('A1:Y1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `Monthly Advance Report (${data.period})`;
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE7F3F9' }
    };

    // Add summary section
    worksheet.addRow([]);
    const summaryStartRow = 3;
    worksheet.mergeCells(`A${summaryStartRow}:D${summaryStartRow}`);
    worksheet.getCell(`A${summaryStartRow}`).value = 'Summary';
    worksheet.getCell(`A${summaryStartRow}`).font = { bold: true, size: 12 };

    worksheet.addRow(['Total Advances', data.summary.totalAdvances, 'Total Amount', `KES ${data.summary.totalAmount.toLocaleString()}`]);
    worksheet.addRow(['Total Repaid', `KES ${data.summary.totalRepaid.toLocaleString()}`, 'Outstanding', `KES ${data.summary.totalOutstanding.toLocaleString()}`]);
    worksheet.addRow(['Total Withdrawn', `KES ${data.summary.totalWithdrawn.toLocaleString()}`, 'Total Interest', `KES ${data.summary.totalInterest.toLocaleString()}`]);
    worksheet.addRow(['Average Amount', `KES ${data.summary.averageAmount.toLocaleString()}`, 'Avg. Repayment Period', `${data.summary.averageRepaymentPeriod.toFixed(1)} months`]);

    // Style header row
    const headerRow = worksheet.addRow([]);
    worksheet.columns.forEach(col => {
      const header = Array.isArray(col.header) ? col.header.join(', ') : col.header;
      headerRow.getCell(col.number).value = header;
    });
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0891B2' }
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // Add data rows
    data.advances.forEach((advance) => {
      const interestAmount = (advance.amount * advance.interestRate) / 100;
      const outstanding = advance.totalRepayment - (advance.amountRepaid || 0);

      const row = worksheet.addRow({
        empId: advance.employee?.employeeId || 'N/A',
        name: advance.employee?.firstName && advance.employee?.lastName ?
          `${advance.employee.firstName} ${advance.employee.lastName}` : 'N/A',
        nationalId: advance.employee?.nationalId || 'N/A',
        email: advance.employee?.email || 'N/A',
        phone: advance.employee?.phoneNumber || 'N/A',
        department: advance.employee?.department || 'N/A',
        position: advance.employee?.position || 'N/A',
        purpose: advance.purpose,
        amount: advance.amount,
        interestRate: advance.interestRate / 100,
        interestAmount: interestAmount,
        totalRepayment: advance.totalRepayment,
        amountWithdrawn: advance.amountWithdrawn || 0,
        repaidAmount: advance.amountRepaid || 0,
        outstanding: outstanding,
        repaymentPeriod: advance.repaymentPeriod,
        installmentAmount: advance.installmentAmount,
        status: advance.status,
        requestDate: format(new Date(advance.requestedDate), 'dd MMM yyyy HH:mm', { locale: enGB }),
        approvalDate: advance.approvedDate ? format(new Date(advance.approvedDate), 'dd MMM yyyy HH:mm', { locale: enGB }) : 'N/A',
        approvedBy: advance.approvedBy?.firstName ?
          `${advance.approvedBy.firstName} ${advance.approvedBy.lastName} (${advance.approvedBy.employeeId})` : 'N/A',
        disbursedDate: advance.disbursedDate ? format(new Date(advance.disbursedDate), 'dd MMM yyyy HH:mm', { locale: enGB }) : 'N/A',
        disbursedBy: advance.disbursedBy?.firstName ?
          `${advance.disbursedBy.firstName} ${advance.disbursedBy.lastName} (${advance.disbursedBy.employeeId})` : 'N/A',
        paymentMethod: advance.preferredPaymentMethod,
        comments: advance.comments || 'N/A',
      });

      // Style number columns
      ['amount', 'interestAmount', 'totalRepayment', 'amountWithdrawn', 'repaidAmount', 'outstanding', 'installmentAmount'].forEach(key => {
        const cell = row.getCell(worksheet.getColumn(key).number);
        cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: 'right' };
      });

      // Style percentage columns
      ['interestRate'].forEach(key => {
        const cell = row.getCell(worksheet.getColumn(key).number);
        cell.numFmt = '0.00%';
        cell.alignment = { horizontal: 'right' };
      });

      // Add conditional formatting for status
      const statusCell = row.getCell(worksheet.getColumn('status').number);
      switch (advance.status.toLowerCase()) {
        case 'approved':
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF90EE90' } };
          break;
        case 'pending':
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD700' } };
          break;
        case 'disbursed':
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF87CEEB' } };
          break;
        case 'rejected':
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B6B' } };
          break;
      }
    });

    // Add borders to all cells
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    // Freeze the header row
    worksheet.views = [
      { state: 'frozen', xSplit: 0, ySplit: 8, topLeftCell: 'A9', activeCell: 'A9' }
    ];

    return await workbook.xlsx.writeBuffer() as Buffer;
  }

  private async generatePDFReport(data: any): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      bufferPages: true,
    });

    const buffers: any[] = [];
    doc.on('data', buffers.push.bind(buffers));

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('Innova Limited', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(18).text('Monthly Advance Report', { align: 'center' });
    doc.fontSize(14).text(`Period: ${data.period}`, { align: 'center' });
    doc.moveDown(1.5);

    // Summary Section
    doc.fontSize(16).font('Helvetica-Bold').text('Summary', { underline: true });
    doc.moveDown(0.5);

    const summaryData = [
      ['Total Advances', data.summary.totalAdvances],
      ['Total Amount', `KES ${data.summary.totalAmount.toLocaleString()}`],
      ['Total Repaid', `KES ${data.summary.totalRepaid.toLocaleString()}`],
      ['Total Interest', `KES ${data.summary.totalInterest.toLocaleString()}`],
      ['Outstanding', `KES ${data.summary.totalOutstanding.toLocaleString()}`],
      ['Total Withdrawn', `KES ${data.summary.totalWithdrawn.toLocaleString()}`],
      ['Average Amount', `KES ${data.summary.averageAmount.toLocaleString()}`],
      ['Avg. Repayment Period', `${data.summary.averageRepaymentPeriod.toFixed(1)} months`]
    ];

    summaryData.forEach(([label, value]) => {
      doc.fontSize(12).text(`${label}: ${value}`);
    });

    doc.moveDown(1.5);

    // Status & Department Breakdown
    doc.fontSize(14).font('Helvetica-Bold').text('Status Breakdown', { underline: true });
    Object.entries(data.summary.statusBreakdown).forEach(([status, count]) => {
      doc.fontSize(12).text(`• ${status}: ${count}`, { indent: 10 });
    });
    doc.moveDown(1);

    doc.fontSize(14).text('Department Breakdown', { underline: true });
    Object.entries(data.summary.departmentBreakdown).forEach(([dept, info]: [string, any]) => {
      doc.fontSize(12).text(`• ${dept}: ${info.count} advances - KES ${info.amount.toLocaleString()}`, { indent: 10 });
    });

    doc.moveDown(2);

    // Detailed Advance List
    doc.fontSize(16).font('Helvetica-Bold').text('Detailed Advance List', { underline: true });
    doc.moveDown(1);

    data.advances.forEach((advance: any) => {
      if (doc.y > 650) doc.addPage();

      doc.fontSize(13).font('Helvetica-Bold').text(`Employee: ${advance.employee?.firstName} ${advance.employee?.lastName}`);
      doc.fontSize(11).font('Helvetica').text(`ID: ${advance.employee?.employeeId || 'N/A'}`);
      doc.text(`Department: ${advance.employee?.department || 'N/A'}`);
      doc.text(`Position: ${advance.employee?.position || 'N/A'}`);
      doc.moveDown(0.5);

      doc.fontSize(13).font('Helvetica-Bold').text('Financial Details');
      doc.fontSize(11).font('Helvetica').text(`Amount: KES ${advance.amount.toLocaleString()}`);
      doc.text(`Interest (${advance.interestRate}%): KES ${((advance.amount * advance.interestRate) / 100).toLocaleString()}`);
      doc.text(`Repaid: KES ${(advance.amountRepaid || 0).toLocaleString()}`);
      doc.text(`Outstanding: KES ${(advance.totalRepayment - (advance.amountRepaid || 0)).toLocaleString()}`);
      doc.moveDown(0.5);

      doc.fontSize(13).font('Helvetica-Bold').text('Status & Timeline');
      doc.fontSize(11).text(`Status: ${advance.status.toUpperCase()}`);
      doc.text(`Requested: ${advance.requestedDate}`);
      if (advance.approvedDate) doc.text(`Approved: ${advance.approvedDate}`);
      if (advance.disbursedDate) doc.text(`Disbursed: ${advance.disbursedDate}`);

      doc.moveDown(1.5);
    });

    // Page numbers
    let pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      if (i > 0) {
        doc.fontSize(12).text('Innova Limited - Monthly Advance Report', 50, 30);
        doc.text(data.period, { align: 'right' });
      }
      doc.fontSize(10).text(`Page ${i + 1} of ${pageCount}`, 50, doc.page.height - 50, { align: 'center' });
    }

    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });
  }


  private getStatusColor(status: string): string {
    switch (status.toLowerCase()) {
      case 'approved':
        return '#2ecc71';
      case 'pending':
        return '#f1c40f';
      case 'disbursed':
        return '#3498db';
      case 'rejected':
        return '#e74c3c';
      default:
        return '#000000';
    }
  }

  private async generateCSVReport(data: any): Promise<Buffer> {
    const records = data.advances.map((advance: any) => ({
      // Employee Details
      employeeId: advance.employee?.employeeId || 'N/A',
      firstName: advance.employee?.firstName || 'N/A',
      lastName: advance.employee?.lastName || 'N/A',
      nationalId: advance.employee?.nationalId || 'N/A',
      email: advance.employee?.email || 'N/A',
      phone: advance.employee?.phoneNumber || 'N/A',
      department: advance.employee?.department || 'N/A',
      position: advance.employee?.position || 'N/A',

      // Advance Details
      purpose: advance.purpose || 'N/A',
      amount: advance.amount,
      interestRate: advance.interestRate,
      interestAmount: (advance.amount * advance.interestRate) / 100,
      totalRepayment: advance.totalRepayment,
      amountWithdrawn: advance.amountWithdrawn || 0,
      amountRepaid: advance.amountRepaid || 0,
      outstanding: advance.totalRepayment - (advance.amountRepaid || 0),
      repaymentPeriod: advance.repaymentPeriod,
      installmentAmount: advance.installmentAmount,

      // Status and Dates
      status: advance.status,
      requestDate: format(new Date(advance.requestedDate), 'dd MMM yyyy HH:mm', { locale: enGB }),
      approvalDate: advance.approvedDate ? format(new Date(advance.approvedDate), 'dd MMM yyyy HH:mm', { locale: enGB }) : 'N/A',
      approvedBy: advance.approvedBy?.firstName ?
        `${advance.approvedBy.firstName} ${advance.approvedBy.lastName} (${advance.approvedBy.employeeId})` : 'N/A',
      disbursedDate: advance.disbursedDate ? format(new Date(advance.disbursedDate), 'dd MMM yyyy HH:mm', { locale: enGB }) : 'N/A',
      disbursedBy: advance.disbursedBy?.firstName ?
        `${advance.disbursedBy.firstName} ${advance.disbursedBy.lastName} (${advance.disbursedBy.employeeId})` : 'N/A',

      // Additional Details
      paymentMethod: advance.preferredPaymentMethod,
      comments: advance.comments || 'N/A'
    }));

    const csvWriter = createObjectCsvWriter({
      path: 'temp.csv',
      header: [
        // Employee Details
        { id: 'employeeId', title: 'Employee ID' },
        { id: 'firstName', title: 'First Name' },
        { id: 'lastName', title: 'Last Name' },
        { id: 'nationalId', title: 'National ID' },
        { id: 'email', title: 'Email' },
        { id: 'phone', title: 'Phone' },
        { id: 'department', title: 'Department' },
        { id: 'position', title: 'Position' },

        // Advance Details
        { id: 'purpose', title: 'Purpose' },
        { id: 'amount', title: 'Amount (KES)' },
        { id: 'interestRate', title: 'Interest Rate (%)' },
        { id: 'interestAmount', title: 'Interest Amount (KES)' },
        { id: 'totalRepayment', title: 'Total Repayment (KES)' },
        { id: 'amountWithdrawn', title: 'Amount Withdrawn (KES)' },
        { id: 'amountRepaid', title: 'Amount Repaid (KES)' },
        { id: 'outstanding', title: 'Outstanding (KES)' },
        { id: 'repaymentPeriod', title: 'Repayment Period (Months)' },
        { id: 'installmentAmount', title: 'Installment Amount (KES)' },

        // Status and Dates
        { id: 'status', title: 'Status' },
        { id: 'requestDate', title: 'Request Date' },
        { id: 'approvalDate', title: 'Approval Date' },
        { id: 'approvedBy', title: 'Approved By' },
        { id: 'disbursedDate', title: 'Disbursed Date' },
        { id: 'disbursedBy', title: 'Disbursed By' },

        // Additional Details
        { id: 'paymentMethod', title: 'Payment Method' },
        { id: 'comments', title: 'Comments' }
      ]
    });

    await csvWriter.writeRecords(records);

    // Add summary section at the top
    const summaryLines = [
      `Innova Limited - Monthly Advance Report (${data.period})`,
      '',
      'Summary',
      `Total Advances,${data.summary.totalAdvances}`,
      `Total Amount (KES),${data.summary.totalAmount.toLocaleString()}`,
      `Total Repaid (KES),${data.summary.totalRepaid.toLocaleString()}`,
      `Outstanding (KES),${data.summary.totalOutstanding.toLocaleString()}`,
      `Total Withdrawn (KES),${data.summary.totalWithdrawn.toLocaleString()}`,
      `Total Interest (KES),${data.summary.totalInterest.toLocaleString()}`,
      `Average Amount (KES),${data.summary.averageAmount.toLocaleString()}`,
      `Average Repayment Period (Months),${data.summary.averageRepaymentPeriod.toFixed(1)}`,
      '',
      'Detailed Records Below',
      ''
    ].join('\n');

    const detailedRecords = records.map(record =>
      Object.values(record).join(',')
    ).join('\n');

    return Buffer.from(summaryLines + '\n' + detailedRecords);
  }

  async generateManualReport(docformat: 'pdf' | 'excel' | 'csv'): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    try {
      const data = await this.getMonthlyReportData();
      const now = new Date();
      const timestamp = format(now, 'yyyy-MM-dd_HH-mm', { locale: enGB });

      switch (docformat.toLowerCase()) {
        case 'pdf':
          return {
            buffer: await this.generatePDFReport(data),
            filename: `advance_report_${timestamp}.pdf`,
            contentType: 'application/pdf'
          };
        case 'excel':
          return {
            buffer: await this.generateExcelReport(data),
            filename: `advance_report_${timestamp}.xlsx`,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          };
        case 'csv':
          return {
            buffer: await this.generateCSVReport(data),
            filename: `advance_report_${timestamp}.csv`,
            contentType: 'text/csv'
          };
        default:
          throw new Error('Unsupported format');
      }
    } catch (error) {
      this.logger.error(`Failed to generate manual report: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async sendReportEmail(
    email: string,
    reportBuffer: Buffer,
    Format: string,
  ) {
    const subject = 'Monthly Advance Report';
    const message = this.generateEmailTemplate();
    const now = new Date();
    const timestamp = format(now, 'yyyy-MM-dd_HH-mm', { locale: enGB });

    // Map format to correct file extension
    const extensionMap = {
      excel: 'xlsx',
      pdf: 'pdf',
      csv: 'csv'
    };

    try {
      await this.notificationService.sendEmailWithAttachments(email, subject, message, [
        {
          filename: `advance_report_${timestamp}.${extensionMap[Format] || Format}`,
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
