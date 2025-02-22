import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Advance, AdvanceDocument } from '../schemas/advance.schema';
import { CreateAdvanceDto } from '../dto/advance.dto';
import { UpdateAdvanceStatusDto } from '../dto/advance.dto';
import { AdvanceFilterDto } from '../dto/advance.dto';
import {
  AdvanceCalculationResponseDto,
  MonthlyAdvanceSummaryDto,
  DailyAdvanceDto,
} from '../dto/advance-calculation.dto';
import { User, UserDocument } from '../../auth/schemas/user.schema';
import {
  SystemConfig,
  SystemConfigDocument,
} from '../../system-config/schemas/system-config.schema';
import { PaymentMethod } from '../enums/payment-method.enum';
import { SystemLogsService } from '../../system-logs/services/system-logs.service';
import { LogSeverity } from '../../system-logs/schemas/system-log.schema';
import { Request } from 'express';
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  isWithinInterval,
} from 'date-fns';
import { NotificationService } from '../../notifications/services/notification.service';

@Injectable()
export class AdvanceService {
  constructor(
    @InjectModel(Advance.name)
    private readonly advanceModel: Model<AdvanceDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(SystemConfig.name)
    private readonly systemConfigModel: Model<SystemConfigDocument>,
    private readonly systemLogsService: SystemLogsService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(
    employeeId: string,
    createAdvanceDto: CreateAdvanceDto,
    req?: Request,
  ): Promise<Advance> {
    const employee = await this.userModel.findById(employeeId);
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // Check if employee is in their last month of employment
    if (employee.employmentEndDate) {
      const today = new Date();
      const endDate = new Date(employee.employmentEndDate);
      const lastMonthInterval = {
        start: startOfMonth(endDate),
        end: endOfMonth(endDate),
      };

      if (isWithinInterval(today, lastMonthInterval)) {
        throw new BadRequestException(
          'Cannot apply for advance in the last month of employment',
        );
      }
    }

    // Get employee's basic salary
    const basicSalary = await this.getBasicSalary(employeeId);
    if (!basicSalary) {
      throw new BadRequestException('Employee basic salary not found');
    }

    // Calculate half of basic salary
    const halfBasicSalary = basicSalary / 2;

    // Get existing advances in current month
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());

    // Check for pending advances in current month
    const pendingAdvance = await this.advanceModel.findOne({
      employee: new Types.ObjectId(employeeId),
      status: 'pending',
      requestedDate: {
        $gte: monthStart,
        $lte: monthEnd,
      },
    });

    if (pendingAdvance) {
      throw new BadRequestException(
        'You have a pending advance request that needs to be approved first',
      );
    }

    // Get all active advances (pending, approved, disbursed, repaying)
    const existingAdvances = await this.advanceModel.find({
      employee: new Types.ObjectId(employeeId),
      status: { $in: ['pending', 'approved', 'disbursed', 'repaying'] },
      requestedDate: {
        $gte: monthStart,
        $lte: monthEnd,
      },
    });

    // Calculate total amount of existing advances in current month
    const totalExistingAmount = existingAdvances.reduce(
      (sum, advance) => sum + advance.amount,
      0,
    );

    // Check if new advance would exceed half of basic salary
    if (totalExistingAmount + createAdvanceDto.amount > halfBasicSalary) {
      throw new BadRequestException(
        'Total advances in current month cannot exceed half of basic salary',
      );
    }

    // Get system configuration
    const config = await this.getAdvanceConfig();

    // Check if advances are currently suspended
    const now = new Date();
    const activeSuspensionPeriod = config.suspensionPeriods?.find((period) => {
      const startDate = new Date(period.startDate);
      const endDate = new Date(period.endDate);
      return period.isActive && now >= startDate && now <= endDate;
    });

    if (activeSuspensionPeriod) {
      throw new BadRequestException(
        `Advance applications are currently suspended until ${new Date(
          activeSuspensionPeriod.endDate,
        ).toLocaleDateString()}.`,
      );
    }

    // Check if employee has reached max active advances limit
    if (existingAdvances.length >= config.maxActiveAdvances) {
      throw new BadRequestException(
        'Maximum number of active advances reached',
      );
    }

    // Calculate advance metrics
    const metrics = await this.calculateAdvanceMetrics(employeeId);

    // Calculate available advance amount
    const availableAdvance = Math.max(
      0,
      metrics.availableAdvance - metrics.repaymentBalance,
    );

    if (createAdvanceDto.amount > availableAdvance) {
      throw new BadRequestException(
        `Requested amount exceeds available advance amount of ${availableAdvance}`,
      );
    }
    // Create new advance
    const advance = new this.advanceModel({
      ...createAdvanceDto,
      employee: new Types.ObjectId(employeeId),
      requestedDate: new Date(),
      status: 'pending',
      interestRate: config.advanceDefaultInterestRate,
      totalRepayment: createAdvanceDto.amount,
      installmentAmount:
        createAdvanceDto.amount / createAdvanceDto.repaymentPeriod,
    });

    // Save advance
    const savedAdvance = await advance.save();

    // Create system log
    if (req) {
      await this.systemLogsService.createLog(
        'Advance Request',
        `New advance request of KES ${createAdvanceDto.amount} created`,
        LogSeverity.INFO,
        employee.employeeId?.toString(),
        req,
      );
    }

    // Format amount for notification
    const formattedAmount = createAdvanceDto.amount.toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const message = `Your advance request of KES ${formattedAmount} has been submitted successfully. You will be notified once it is approved. Thank you for using our service.`;

    // Send SMS notification
    await this.notificationService.sendSMS(employee.phoneNumber, message);

    // Format values for email template
    const monthlyInstallment = (
      createAdvanceDto.amount / createAdvanceDto.repaymentPeriod
    ).toLocaleString('en-KE', {
      minimumFractionDigits: 2,
    });
    const totalRepayment = createAdvanceDto.amount.toLocaleString('en-KE', {
      minimumFractionDigits: 2,
    });
    const paymentMethod = createAdvanceDto.preferredPaymentMethod
      ? createAdvanceDto.preferredPaymentMethod.toUpperCase()
      : 'NOT SPECIFIED';

    // Create HTML email template
    const htmlMessage = `
      <div style="padding: 20px 0;">
        <div style="background-color: #f8fafc; border-left: 4px solid #0891b2; padding: 16px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 16px 0; color: #0891b2;">Salary Advance Request Submitted</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Request Amount</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right;">KES ${formattedAmount}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Purpose</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right;">${createAdvanceDto.purpose || 'Not specified'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Repayment Period</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right;">${createAdvanceDto.repaymentPeriod} months</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Interest Rate</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right;">${config.advanceDefaultInterestRate}%</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Monthly Installment</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right;">KES ${monthlyInstallment}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Total Repayment</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right;">KES ${totalRepayment}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Payment Method</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right;">${paymentMethod}</td>
            </tr>
          </table>
        </div>
        <div style="margin-top: 24px; padding: 16px; background-color: #f0f9ff; border-radius: 4px;">
          <h3 style="margin: 0 0 8px 0; color: #0369a1;">Next Steps</h3>
          <p style="margin: 0; color: #075985; font-size: 14px;">
            Your advance request is now pending approval. You will receive another notification once your request has been reviewed.
            The approval process typically takes 1-2 business days.
          </p>
        </div>
        <p style="color: #64748b; font-size: 14px; margin-top: 24px;">
          For any queries about your advance request, please contact our support team.
        </p>
      </div>
    `;

    // Send email notification
    if (employee.email) {
      await this.notificationService.sendEmail(
        employee.email,
        'Salary Advance Request Confirmation',
        htmlMessage,
      );
    }

    // Get system configuration for admin notifications
    const systemConfig = await this.systemConfigModel.findOne({
      key: 'notification_config',
      type: 'notification',
      isActive: true,
    });

    if (systemConfig?.data?.notificationAdmins) {
      // Filter admins who have subscribed to advance alerts
      const advanceAdmins = systemConfig.data.notificationAdmins.filter(
        (admin) => admin.notificationTypes.includes('advance_alert'),
      );

      // Send notifications to all relevant admins
      for (const admin of advanceAdmins) {
        // Create admin notification message
        const adminMessage = `New Advance Request Alert:
Employee: ${employee.firstName} ${employee.lastName}
Amount: KES ${formattedAmount}
Purpose: ${createAdvanceDto.purpose || 'Not specified'}`;

        // Send SMS to admin
        if (admin.phone) {
          await this.notificationService.sendSMS(admin.phone, adminMessage);
        }

        // Send email to admin
        if (admin.email) {
          const adminEmailTemplate = `
            <div style="padding: 20px 0;">
              <div style="background-color: #f8fafc; border-left: 4px solid #0891b2; padding: 16px; margin-bottom: 24px;">
                <h2 style="margin: 0 0 16px 0; color: #0891b2;">New Advance Request Alert</h2>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #64748b;">Employee Name</td>
                    <td style="padding: 8px 0; color: #1e293b; text-align: right;">${employee.firstName} ${employee.lastName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b;">Employee ID</td>
                    <td style="padding: 8px 0; color: #1e293b; text-align: right;">${employee.employeeId || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b;">Request Amount</td>
                    <td style="padding: 8px 0; color: #1e293b; text-align: right;">KES ${formattedAmount}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b;">Purpose</td>
                    <td style="padding: 8px 0; color: #1e293b; text-align: right;">${createAdvanceDto.purpose || 'Not specified'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b;">Repayment Period</td>
                    <td style="padding: 8px 0; color: #1e293b; text-align: right;">${createAdvanceDto.repaymentPeriod} months</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b;">Monthly Installment</td>
                    <td style="padding: 8px 0; color: #1e293b; text-align: right;">KES ${monthlyInstallment}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b;">Payment Method</td>
                    <td style="padding: 8px 0; color: #1e293b; text-align: right;">${paymentMethod}</td>
                  </tr>
                </table>
              </div>
              <div style="margin-top: 24px; padding: 16px; background-color: #f0f9ff; border-radius: 4px;">
                <h3 style="margin: 0 0 8px 0; color: #0369a1;">Action Required</h3>
                <p style="margin: 0; color: #075985; font-size: 14px;">
                  Please review this advance request and take appropriate action (approve/decline) through the admin portal.
                </p>
              </div>
            </div>
          `;

          await this.notificationService.sendEmail(
            admin.email,
            'New Advance Request - Action Required',
            adminEmailTemplate,
          );
        }
      }
    }

    return savedAdvance;
  }

  async findAll(filterDto: AdvanceFilterDto) {
    const {
      status,
      employee,
      minAmount,
      maxAmount,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = filterDto;

    const query: any = {};

    if (status) {
      query.status = status;
    }

    if (employee) {
      query.employee = new Types.ObjectId(employee.toString());
    }

    if (minAmount !== undefined || maxAmount !== undefined) {
      query.amount = {};
      if (minAmount !== undefined) {
        query.amount.$gte = minAmount;
      }
      if (maxAmount !== undefined) {
        query.amount.$lte = maxAmount;
      }
    }

    if (startDate || endDate) {
      query.requestedDate = {};
      if (startDate) {
        query.requestedDate.$gte = startDate;
      }
      if (endDate) {
        query.requestedDate.$lte = endDate;
      }
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.advanceModel
        .find(query)
        .populate('employee', 'firstName lastName email employeeId')
        .populate('approvedBy', 'firstName lastName email employeeId')
        .populate('disbursedBy', 'firstName lastName email employeeId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.advanceModel.countDocuments(query),
    ]);

    return { data, total };
  }

  async findOne(id: string): Promise<Advance> {
    const advance = await this.advanceModel
      .findById(id)
      .populate('employee', 'firstName lastName email employeeId')
      .populate('approvedBy', 'firstName lastName email employeeId')
      .populate('disbursedBy', 'firstName lastName email employeeId');

    if (!advance) {
      throw new NotFoundException(`Advance #${id} not found`);
    }

    return advance;
  }

  async updateStatus(
    id: string,
    adminId: string,
    updateAdvanceStatusDto: UpdateAdvanceStatusDto,
    req?: Request,
  ) {
    const advance = await this.findOne(id);
    const newStatus = updateAdvanceStatusDto.status;

    // Validate status transition
    this.validateStatusTransition(advance.status, newStatus);

    const update: Partial<Advance> = {
      status: newStatus,
      comments: updateAdvanceStatusDto.comments,
    };

    // Add approval or disbursement details
    if (newStatus === 'approved') {
      update.approvedBy = new Types.ObjectId(adminId);
      update.approvedDate = new Date();
    } else if (newStatus === 'disbursed') {
      update.disbursedBy = new Types.ObjectId(adminId);
      update.disbursedDate = new Date();
    }

    const updatedAdvance = await this.advanceModel
      .findByIdAndUpdate(id, update, { new: true })
      .populate<{ employee: User }>('employee')
      .exec();

    if (!updatedAdvance) {
      throw new NotFoundException(`Advance with ID ${id} not found`);
    }

    await this.systemLogsService.createLog(
      'Advance Status Update',
      `Advance status updated to ${updateAdvanceStatusDto.status}`,
      LogSeverity.INFO,
      updatedAdvance.employee.employeeId?.toString(),
      req,
    );

    // Format amount for notification
    const formattedAmount = updatedAdvance.amount.toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const formattedInstallment =
      updatedAdvance.installmentAmount?.toLocaleString('en-KE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) || '0.00';

    // Send status-specific notification
    let message = '';
    let emailSubject = '';
    let emailTemplate = '';

    const templateData = {
      amount: formattedAmount,
      installment: formattedInstallment,
      comments: updateAdvanceStatusDto.comments,
    };

    switch (updateAdvanceStatusDto.status) {
      case 'declined':
        message = `Your advance request of KES ${formattedAmount} has been declined. Reason: ${updateAdvanceStatusDto.comments || 'Not specified'}. For more information, please contact HR. Thank you for using our service.`;
        emailSubject = 'Advance Request Declined';
        emailTemplate = this.getStatusUpdateTemplate(
          'Advance Request Declined',
          'declined',
          `We regret to inform you that your advance request has been declined.${updateAdvanceStatusDto.comments ? ` Reason: ${updateAdvanceStatusDto.comments}` : ''}`,
          'Please contact HR for more information or to discuss alternative options.',
          templateData,
        );
        break;

      case 'disbursed':
        message = `Your advance of KES ${formattedAmount} has been disbursed. Please check your Innova advance account balance to confirm the disbursal and withdraw the funds. Thank you for using our service.`;
        emailSubject = 'Advance Disbursement Confirmation';
        emailTemplate = this.getStatusUpdateTemplate(
          'Advance Successfully Disbursed',
          'disbursed',
          'Your advance has been successfully disbursed to your account.',
          'You can now check your Innova advance account balance and withdraw the funds.',
          templateData,
        );
        break;

      case 'approved':
        message = `Your advance request of KES ${formattedAmount} has been approved. The funds will be disbursed to your account shortly. Thank you for using our service.`;
        emailSubject = 'Advance Request Approved';
        emailTemplate = this.getStatusUpdateTemplate(
          'Advance Request Approved',
          'approved',
          'Congratulations! Your advance request has been approved.',
          'The funds will be disbursed to your account shortly. You will receive another notification once the disbursement is complete.',
          templateData,
        );
        break;

      case 'repaying':
        message = `Your advance of KES ${formattedAmount} has entered repayment phase. Monthly installment of KES ${formattedInstallment} will be deducted from your salary. Thank you for using our service.`;
        emailSubject = 'Advance Repayment Started';
        emailTemplate = this.getStatusUpdateTemplate(
          'Advance Repayment Initiated',
          'repaying',
          `Your advance has entered the repayment phase. A monthly installment of KES ${formattedInstallment} will be deducted from your salary.`,
          'Ensure your salary account has sufficient funds for the monthly deductions. The repayment will be automatically processed.',
          templateData,
        );
        break;

      case 'repaid':
        message = `Your advance of KES ${formattedAmount} has been fully repaid. You may now apply for another advance if needed. Thank you for your timely repayments.`;
        emailSubject = 'Advance Fully Repaid';
        emailTemplate = this.getStatusUpdateTemplate(
          'Advance Successfully Repaid',
          'repaid',
          'Congratulations! Your advance has been fully repaid.',
          'You may now apply for another advance if needed. Thank you for your timely repayments.',
          templateData,
        );
        break;
    }

    // Send SMS notification
    if (message && updatedAdvance.employee?.phoneNumber) {
      await this.notificationService.sendSMS(
        updatedAdvance.employee.phoneNumber,
        message,
      );
    }

    // Send email notification
    if (emailTemplate && updatedAdvance.employee?.email) {
      await this.notificationService.sendEmail(
        updatedAdvance.employee.email,
        emailSubject,
        emailTemplate,
      );
    }

    return updatedAdvance;
  }

  async findByEmployee(employeeId: string): Promise<Advance[]> {
    return this.advanceModel
      .find({ employee: new Types.ObjectId(employeeId) })
      .populate('approvedBy', 'firstName lastName email employeeId')
      .populate('disbursedBy', 'firstName lastName email employeeId')
      .sort({ createdAt: -1 });
  }

  async getAdvanceStatistics() {
    const pipeline = [
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          averageAmount: { $avg: '$amount' },
        },
      },
    ];

    const stats = await this.advanceModel.aggregate(pipeline);
    return stats.reduce((acc: any, curr) => {
      acc[curr._id] = {
        count: curr.count,
        totalAmount: curr.totalAmount,
        averageAmount: curr.averageAmount,
      };
      return acc;
    }, {});
  }

  async calculateAvailableAdvance(
    employeeId: string,
  ): Promise<AdvanceCalculationResponseDto> {
    // Get employee's base salary from user profile
    const employee = await this.userModel
      .findById(employeeId)
      .select('baseSalary');
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const basicSalary = employee.baseSalary;
    if (!basicSalary) {
      throw new BadRequestException('Employee base salary not set');
    }

    const config = await this.getAdvanceConfig();
    const maxAdvanceAmount = (basicSalary * config.maxAdvancePercentage) / 100;

    // Get current date
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    // Get total days in current month
    const lastDayOfMonth = new Date(currentYear, currentMonth, 0).getDate();

    // Calculate daily increment
    const dailyIncrement = maxAdvanceAmount / lastDayOfMonth;

    // Calculate available advance based on current day
    const runningTotal = dailyIncrement * today.getDate();
    const cappedAmount = Math.min(runningTotal, maxAdvanceAmount);
    const availableAdvance = Math.floor(cappedAmount / 100) * 100;

    // Get advance history metrics
    const advances = await this.advanceModel.find({
      employee: employeeId,
    });

    // Calculate metrics based on advance statuses
    const metrics = advances.reduce(
      (acc, advance) => {
        // Count all disbursed advances as previous advances
        if (
          advance.status === 'disbursed' ||
          advance.status === 'repaying' ||
          advance.status === 'repaid'
        ) {
          acc.totalDisbursed += advance.amount;
        }

        // Add to repayment balance if advance is disbursed or being repaid
        if (advance.status === 'disbursed' || advance.status === 'repaying') {
          const amountRepaid = advance.amountRepaid || 0;
          const totalDue = advance.amount;
          acc.repaymentBalance += Math.ceil(totalDue - amountRepaid);
        }

        // Calculate total repaid amount
        if (advance.amountRepaid) {
          acc.totalRepaid += advance.amountRepaid;
        }

        return acc;
      },
      { totalDisbursed: 0, repaymentBalance: 0, totalRepaid: 0 },
    );

    // Calculate next payday (25th of current or next month)
    const nextPayday = this.calculateNextPayday();

    const approvedAdvances = await this.advanceModel.find({
      employee: new Types.ObjectId(employeeId),
      status: { $in: ['disbursed', 'repaying'] },
    });

    // Calculate total approved amount and interest separately
    const totals = approvedAdvances.reduce(
      (acc, advance) => {
        const interestRate = advance.interestRate || 0;
        const interest = (advance.amount * interestRate) / 100;
        return {
          totalAmount: acc.totalAmount + advance.amount,
          totalInterest: acc.totalInterest + interest,
        };
      },
      { totalAmount: 0, totalInterest: 0 },
    );

    // Calculate total withdrawn amount
    const totalWithdrawnAmount = approvedAdvances.reduce(
      (sum, advance) => sum + (advance.amountWithdrawn || 0),
      0,
    );

    // Available amount is approved amount minus interest minus what's already withdrawn
    const availableAmount =
      totals.totalAmount - totals.totalInterest - totalWithdrawnAmount;

    // Return calculated advance details
    return {
      availableAdvance: Math.max(
        0,
        availableAdvance - metrics.repaymentBalance,
      ),
      maxAdvance: maxAdvanceAmount,
      basicSalary,
      advancePercentage: (availableAdvance / basicSalary) * 100,
      previousAdvances: metrics.totalDisbursed,
      totalAmountRepaid: metrics.totalRepaid,
      repaymentBalance: Math.ceil(metrics.repaymentBalance - availableAmount),
      nextPayday: nextPayday.toISOString().split('T')[0],
    };
  }

  async getMonthlyAdvanceSummary(
    employeeId: string,
    month: number,
    year: number,
  ): Promise<MonthlyAdvanceSummaryDto> {
    const employee = await this.userModel
      .findById(employeeId)
      .select('baseSalary');
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const basicSalary = employee.baseSalary;
    if (!basicSalary) {
      throw new BadRequestException('Employee base salary not set');
    }

    const config = await this.getAdvanceConfig();
    const maxAdvanceAmount = (basicSalary * config.maxAdvancePercentage) / 100;

    // Get all days in the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const daysInMonth = endDate.getDate();

    const dailyAdvances: DailyAdvanceDto[] = [];

    // Calculate available advance for each day
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month - 1, day);
      const isHoliday = await this.isHoliday(currentDate);

      // Calculate daily increment (maxAdvanceAmount divided by total days in month)
      const dailyIncrement = maxAdvanceAmount / daysInMonth;
      const runningTotal = dailyIncrement * day;

      // Cap at maxAdvanceAmount and round to nearest 100
      const cappedAmount = Math.min(runningTotal, maxAdvanceAmount);
      const currentAmount = Math.floor(cappedAmount / 100) * 100;

      dailyAdvances.push({
        date: currentDate.toISOString().split('T')[0],
        availableAmount: currentAmount,
        percentageOfSalary: (currentAmount / basicSalary) * 100,
        isWeekend: false, // Always false as requested
        isHoliday,
      });
    }

    // Get today's date and find today's available amount
    const today = new Date();
    let lastAvailableAmount = 0;

    // Find the most recent amount up to today
    for (let i = dailyAdvances.length - 1; i >= 0; i--) {
      const advance = dailyAdvances[i];
      const advanceDate = new Date(advance.date);
      if (advanceDate <= today) {
        lastAvailableAmount = advance.availableAmount;
        break;
      }
    }

    return {
      month: startDate.toLocaleString('default', { month: 'long' }),
      year,
      basicSalary,
      maxAdvancePercentage: config.maxAdvancePercentage,
      maxAdvanceAmount,
      dailyAdvances,
      totalAvailableToday: lastAvailableAmount,
      previousAdvances: [],
    };
  }

  private calculateNextPayday(): Date {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Payday is 25th of each month
    let nextPayday = new Date(currentYear, currentMonth, 25);

    // If we're past the 25th, next payday is 25th of next month
    if (today.getDate() > 25) {
      nextPayday = new Date(currentYear, currentMonth + 1, 25);
    }

    return nextPayday;
  }

  private async isHoliday(date: Date): Promise<boolean> {
    // Implement holiday checking logic here
    // This could involve checking against a holiday database or API
    return false;
  }

  private async getAdvanceConfig() {
    const config = await this.systemConfigModel.findOne({
      key: 'advance_config',
      type: 'advance',
      isActive: true,
    });

    if (!config) {
      throw new NotFoundException('Advance configuration not found');
    }

    return {
      ...config.data,
      suspensionPeriods: config.suspensionPeriods || [],
    };
  }

  private async getBasicSalary(employeeId: string): Promise<number> {
    const employee = await this.userModel.findById(employeeId);
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    if (!employee.baseSalary) {
      throw new NotFoundException('Employee base salary not found');
    }
    return employee.baseSalary;
  }

  private async calculateAdvanceMetrics(employeeId: string) {
    // Get current month's date range
    const today = new Date();
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);

    // Get advance history metrics for current month
    const advances = await this.advanceModel.find({
      employee: employeeId,
      createdAt: {
        $gte: monthStart,
        $lte: monthEnd,
      },
    });

    // Calculate metrics based on advance statuses
    const metrics = advances.reduce(
      (acc, advance) => {
        // Count all disbursed advances as previous advances
        if (
          advance.status === 'disbursed' ||
          advance.status === 'repaying' ||
          advance.status === 'repaid'
        ) {
          acc.totalDisbursed += advance.amount;
        }

        // Add to repayment balance if advance is disbursed or being repaid
        if (advance.status === 'disbursed' || advance.status === 'repaying') {
          const amountRepaid = advance.amountRepaid || 0;
          const totalDue = advance.amount;
          acc.repaymentBalance += Math.ceil(totalDue - amountRepaid);
        }

        // Calculate total repaid amount
        if (advance.amountRepaid) {
          acc.totalRepaid += advance.amountRepaid;
        }

        return acc;
      },
      { totalDisbursed: 0, repaymentBalance: 0, totalRepaid: 0 },
    );

    // Get employee's base salary from user profile
    const employee = await this.userModel
      .findById(employeeId)
      .select('baseSalary');
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const basicSalary = employee.baseSalary;
    if (!basicSalary) {
      throw new BadRequestException('Employee base salary not set');
    }

    const config = await this.getAdvanceConfig();
    const maxAdvanceAmount = (basicSalary * config.maxAdvancePercentage) / 100;

    // Get current date details
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    // Get total days in current month
    const lastDayOfMonth = new Date(currentYear, currentMonth, 0).getDate();

    // Calculate daily increment
    const dailyIncrement = maxAdvanceAmount / lastDayOfMonth;

    // Calculate available advance based on current day
    const runningTotal = dailyIncrement * today.getDate();
    const cappedAmount = Math.min(runningTotal, maxAdvanceAmount);
    const availableAdvance = Math.floor(cappedAmount / 100) * 100;

    return {
      availableAdvance,
      ...metrics,
    };
  }

  private validateStatusTransition(currentStatus: string, newStatus: string) {
    const validTransitions: { [key: string]: string[] } = {
      pending: ['approved', 'declined', 'disbursed'],
      approved: ['disbursed'],
      declined: [],
      disbursed: ['repaying'],
      repaying: ['repaid'],
      repaid: [],
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition advance from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  private getStatusColor(status: string): string {
    const colors = {
      pending: '#f59e0b', // Amber
      approved: '#10b981', // Emerald
      declined: '#ef4444', // Red
      disbursed: '#3b82f6', // Blue
      repaying: '#8b5cf6', // Purple
      repaid: '#059669', // Green
    };
    return colors[status] || '#6b7280'; // Gray default
  }

  private getStatusIcon(status: string): string {
    const icons = {
      pending: '⏳',
      approved: '✅',
      declined: '❌',
      disbursed: '💰',
      repaying: '📅',
      repaid: '🎉',
    };
    return icons[status] || '📋';
  }

  private getStatusBadge(status: string): string {
    const color = this.getStatusColor(status);
    const icon = this.getStatusIcon(status);
    return `
      <div style="
        display: inline-block;
        background-color: ${color}15;
        color: ${color};
        padding: 4px 12px;
        border-radius: 9999px;
        font-size: 14px;
        font-weight: 500;
        margin: 4px 0;
      ">
        ${icon} ${status.charAt(0).toUpperCase() + status.slice(1)}
      </div>
    `;
  }

  private getStatusUpdateTemplate(
    title: string,
    status: string,
    details: string,
    nextSteps: string,
    data: {
      amount: string;
      installment?: string;
      comments?: string;
    },
  ): string {
    return `
      <div style="padding: 20px 0;">
        <div style="background-color: #f8fafc; border-left: 4px solid ${this.getStatusColor(status)}; padding: 16px; margin-bottom: 24px;">
          <h2 style="margin: 0 0 16px 0; color: ${this.getStatusColor(status)};">
            ${title}
          </h2>
          <div style="margin-bottom: 16px;">
            ${this.getStatusBadge(status)}
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Advance Amount</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right;">KES ${data.amount}</td>
            </tr>
            ${
              data.installment
                ? `
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Monthly Installment</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right;">KES ${data.installment}</td>
            </tr>
            `
                : ''
            }
            ${
              data.comments
                ? `
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Comments</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right;">${data.comments}</td>
            </tr>
            `
                : ''
            }
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Update Date</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right;">${new Date().toLocaleDateString(
                'en-KE',
                {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                },
              )}</td>
            </tr>
          </table>
        </div>
        <div style="margin-top: 24px; padding: 16px; background-color: ${this.getStatusColor(status)}08; border-radius: 4px;">
          <h3 style="margin: 0 0 8px 0; color: ${this.getStatusColor(status)};">Status Details</h3>
          <p style="margin: 0 0 16px 0; color: #075985; font-size: 14px;">
            ${details}
          </p>
          <h3 style="margin: 0 0 8px 0; color: ${this.getStatusColor(status)};">Next Steps</h3>
          <p style="margin: 0; color: #075985; font-size: 14px;">
            ${nextSteps}
          </p>
        </div>
        <p style="color: #64748b; font-size: 14px; margin-top: 24px;">
          For any queries about your advance, please contact our support team.
        </p>
      </div>
    `;
  }
}
