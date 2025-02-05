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
  ): Promise<Advance> {
    const advance = await this.findOne(id);

    // Validate status transition
    this.validateStatusTransition(
      advance.status,
      updateAdvanceStatusDto.status,
    );

    const update: any = {
      status: updateAdvanceStatusDto.status,
      comments: updateAdvanceStatusDto.comments,
    };

    // Add approval or disbursement details
    if (updateAdvanceStatusDto.status === 'approved') {
      update.approvedBy = new Types.ObjectId(adminId);
      update.approvedDate = new Date();
    } else if (updateAdvanceStatusDto.status === 'disbursed') {
      update.disbursedBy = new Types.ObjectId(adminId);
      update.disbursedDate = new Date();
    }

    const updatedAdvance = await this.advanceModel
      .findByIdAndUpdate(id, update, { new: true })
      .populate('employee', 'firstName lastName email employeeId')
      .populate('approvedBy', 'firstName lastName email employeeId')
      .populate('disbursedBy', 'firstName lastName email employeeId');

    await this.systemLogsService.createLog(
      'Advance Status Update',
      `Advance status updated to ${updateAdvanceStatusDto.status}`,
      LogSeverity.INFO,
      updatedAdvance.employee.id?.toString(),
      req,
    );

    return updatedAdvance;
  }

  private validateStatusTransition(currentStatus: string, newStatus: string) {
    const validTransitions: { [key: string]: string[] } = {
      pending: ['approved', 'declined'],
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

    // Get current date and calculate working days
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    let workingDaysCount = 0;
    let lastNonWeekendAmount = 0;
    let availableAdvance = 0;

    // Calculate up to today's date
    for (let day = 1; day <= today.getDate(); day++) {
      const currentDate = new Date(currentYear, currentMonth - 1, day);
      const isWeekend =
        currentDate.getDay() === 0 || currentDate.getDay() === 6;
      const isHoliday = await this.isHoliday(currentDate);

      if (!isWeekend && !isHoliday) {
        workingDaysCount++;
        // Calculate total accrual up to this working day
        const runningTotal = (maxAdvanceAmount / 22) * workingDaysCount;

        // Cap at maxAdvanceAmount and round to nearest 100
        const cappedAmount = Math.min(runningTotal, maxAdvanceAmount);
        availableAdvance = Math.floor(cappedAmount / 100) * 100;
        lastNonWeekendAmount = availableAdvance;
      } else {
        availableAdvance = lastNonWeekendAmount;
      }
    }

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
          // const interestRate = advance.interestRate || 0;
          // const interest = (advance.amount * interestRate) / 100;
          // const totalDue = advance.amount + interest;
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
      repaymentBalance: metrics.repaymentBalance,
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

    // Get all days in the month - only for the specified month
    const startDate = new Date(year, month - 1, 1); // First day of month
    const endDate = new Date(year, month, 0); // Last day of month
    const daysInMonth = endDate.getDate();

    const dailyAdvances: DailyAdvanceDto[] = [];
    let workingDaysCount = 0;
    let lastNonWeekendAmount = 0;

    // Calculate available advance for each day
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month - 1, day);
      const isWeekend =
        currentDate.getDay() === 0 || currentDate.getDay() === 6;
      const isHoliday = await this.isHoliday(currentDate);

      let currentAmount;

      if (!isWeekend && !isHoliday) {
        workingDaysCount++;
        // Calculate total accrual up to this working day
        const runningTotal = (maxAdvanceAmount / 22) * workingDaysCount;

        // Cap at maxAdvanceAmount and round to nearest 100
        const cappedAmount = Math.min(runningTotal, maxAdvanceAmount);
        currentAmount = Math.floor(cappedAmount / 100) * 100;
        lastNonWeekendAmount = currentAmount;
      } else {
        currentAmount = lastNonWeekendAmount;
      }

      dailyAdvances.push({
        date: currentDate.toISOString().split('T')[0],
        availableAmount: currentAmount,
        percentageOfSalary: (currentAmount / basicSalary) * 100,
        isWeekend,
        isHoliday,
      });
    }

    // Filter out any dates from previous month
    const filteredAdvances = dailyAdvances.filter(
      (advance) => new Date(advance.date).getMonth() === month - 1,
    );

    // Get today's date and find today's available amount
    const today = new Date();

    // Find the last non-weekend day up to today
    let lastAvailableAmount = 0;
    for (let i = filteredAdvances.length - 1; i >= 0; i--) {
      const advance = filteredAdvances[i];
      const advanceDate = new Date(advance.date);
      if (advanceDate <= today && !advance.isWeekend && !advance.isHoliday) {
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
      dailyAdvances: filteredAdvances,
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

    // Default values if no config found
    const defaultConfig = {
      advanceDefaultInterestRate: 5,
      advanceMinAmount: 1000,
      advanceMaxAmount: 50000,
      advanceMaxRepaymentPeriod: 12,
      maxAdvancePercentage: 50,
      maxActiveAdvances: 1,
    };

    return config?.data || defaultConfig;
  }

  private async getBasicSalary(employeeId: string): Promise<number> {
    const employee = await this.userModel.findById(employeeId);
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    // TODO: Replace this with actual basic salary from employment/payroll module
    return 50000; // Placeholder value
  }

  private async calculateAdvanceMetrics(employeeId: string) {
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
          // const interestRate = advance.interestRate || 0;
          // const interest = (advance.amount * interestRate) / 100;
          // const totalDue = advance.amount + interest;
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

    // Get current date and calculate working days
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    let workingDaysCount = 0;
    let lastNonWeekendAmount = 0;
    let availableAdvance = 0;

    // Calculate up to today's date
    for (let day = 1; day <= today.getDate(); day++) {
      const currentDate = new Date(currentYear, currentMonth - 1, day);
      const isWeekend =
        currentDate.getDay() === 0 || currentDate.getDay() === 6;
      const isHoliday = await this.isHoliday(currentDate);

      if (!isWeekend && !isHoliday) {
        workingDaysCount++;
        // Calculate total accrual up to this working day
        const runningTotal = (maxAdvanceAmount / 22) * workingDaysCount;

        // Cap at maxAdvanceAmount and round to nearest 100
        const cappedAmount = Math.min(runningTotal, maxAdvanceAmount);
        availableAdvance = Math.floor(cappedAmount / 100) * 100;
        lastNonWeekendAmount = availableAdvance;
      } else {
        availableAdvance = lastNonWeekendAmount;
      }
    }

    return {
      availableAdvance,
      ...metrics,
    };
  }
}
