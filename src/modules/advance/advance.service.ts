import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Advance, AdvanceDocument } from './schemas/advance.schema';
import { CreateAdvanceDto } from './dto/advance.dto';
import { UpdateAdvanceStatusDto } from './dto/advance.dto';
import { AdvanceFilterDto } from './dto/advance.dto';
import {
  AdvanceCalculationResponseDto,
  MonthlyAdvanceSummaryDto,
  DailyAdvanceDto,
} from './dto/advance-calculation.dto';
import { User, UserDocument } from '../auth/schemas/user.schema';

@Injectable()
export class AdvanceService {
  constructor(
    @InjectModel(Advance.name)
    private readonly advanceModel: Model<AdvanceDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async create(
    employeeId: string,
    createAdvanceDto: CreateAdvanceDto,
  ): Promise<Advance> {
    // 1. Check if employee exists and has base salary set
    const employee = await this.userModel
      .findById(employeeId)
      .select('baseSalary');
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    if (!employee.baseSalary) {
      throw new BadRequestException('Employee base salary not set');
    }

    // 2. Check if employee has any pending or approved advances
    const existingAdvances = await this.advanceModel.find({
      employee: new Types.ObjectId(employeeId),
      status: { $in: ['pending', 'approved', 'disbursed'] },
    });

    if (existingAdvances.length > 0) {
      throw new BadRequestException(
        'Cannot request new advance while having pending, approved, or ongoing advances',
      );
    }

    // 3. Validate repayment period
    const MAX_REPAYMENT_PERIOD = 12; // Maximum 12 months repayment period
    if (createAdvanceDto.repaymentPeriod > MAX_REPAYMENT_PERIOD) {
      throw new BadRequestException(
        `Repayment period cannot exceed ${MAX_REPAYMENT_PERIOD} months`,
      );
    }

    // 5. Calculate advance details
    const interestRate = 5; // 5% interest rate for advances
    const amount = createAdvanceDto.amount;
    const repaymentPeriod = createAdvanceDto.repaymentPeriod;

    // Calculate total repayment and installment amount
    const totalInterest = (amount * interestRate * repaymentPeriod) / 1200; // Monthly interest
    const totalRepayment = amount + totalInterest;
    const installmentAmount = totalRepayment / repaymentPeriod;

    // 6. Check if monthly installment is within reasonable limit (e.g., not more than 50% of monthly salary)
    if (installmentAmount > employee.baseSalary * 0.5) {
      throw new BadRequestException(
        'Monthly repayment amount exceeds 50% of monthly salary',
      );
    }

    // Create and save the advance
    const advance = new this.advanceModel({
      ...createAdvanceDto,
      employee: new Types.ObjectId(employeeId),
      status: 'pending',
      requestedDate: new Date(),
      interestRate,
      totalRepayment,
      installmentAmount,
    });

    return advance.save();
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

    return this.advanceModel
      .findByIdAndUpdate(id, update, { new: true })
      .populate('employee', 'firstName lastName email employeeId')
      .populate('approvedBy', 'firstName lastName email employeeId')
      .populate('disbursedBy', 'firstName lastName email employeeId');
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

    const maxAdvancePercentage = 50; // 50% of basic salary
    const maxAdvance = (basicSalary * maxAdvancePercentage) / 100;

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
        const runningTotal = (maxAdvance / 22) * workingDaysCount;

        // Cap at maxAdvanceAmount and round to nearest 100
        const cappedAmount = Math.min(runningTotal, maxAdvance);
        availableAdvance = Math.floor(cappedAmount / 100) * 100;
        lastNonWeekendAmount = availableAdvance;
      } else {
        availableAdvance = lastNonWeekendAmount;
      }
    }

    // Get advance history metrics
    const advances = await this.advanceModel.find({
      employee: employeeId,
      status: { $in: ['approved', 'repaying', 'repaid'] },
    });

    const totalAdvancesReceived = advances.reduce(
      (sum, adv) => sum + adv.amount,
      0,
    );
    const totalAmountRepaid = advances.reduce(
      (sum, adv) => sum + (adv.amountRepaid || 0),
      0,
    );
    const repaymentBalance = totalAdvancesReceived - totalAmountRepaid;

    // Calculate next payday (25th of current or next month)
    const nextPayday = this.calculateNextPayday();

    // Return calculated advance details without adjusting for repayment balance
    return {
      availableAdvance: availableAdvance, // Use the calculated amount directly
      maxAdvance,
      basicSalary,
      advancePercentage: (availableAdvance / basicSalary) * 100,
      previousAdvances: totalAdvancesReceived,
      totalAmountRepaid,
      repaymentBalance,
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

    const maxAdvancePercentage = 50;
    const maxAdvanceAmount = (basicSalary * maxAdvancePercentage) / 100;

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
      maxAdvancePercentage,
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
}
