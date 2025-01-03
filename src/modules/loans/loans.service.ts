import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Loan, LoanDocument } from './schemas/loan.schema';
import { CreateLoanDto } from './dto/loan.dto';
import { UpdateLoanStatusDto } from './dto/loan.dto';
import { LoanFilterDto } from './dto/loan.dto';

@Injectable()
export class LoansService {
  constructor(
    @InjectModel(Loan.name) private readonly loanModel: Model<LoanDocument>,
  ) {}

  async create(
    employeeId: string,
    createLoanDto: CreateLoanDto,
  ): Promise<Loan> {
    // Calculate loan details
    const interestRate = 12; // 12% annual interest rate
    const amount = createLoanDto.amount;
    const repaymentPeriod = createLoanDto.repaymentPeriod;

    // Calculate total repayment and installment amount
    const totalInterest = (amount * interestRate * repaymentPeriod) / 1200; // Monthly interest
    const totalRepayment = amount + totalInterest;
    const installmentAmount = totalRepayment / repaymentPeriod;

    const loan = new this.loanModel({
      ...createLoanDto,
      employee: new Types.ObjectId(employeeId),
      status: 'pending',
      requestedDate: new Date(),
      interestRate,
      totalRepayment,
      installmentAmount,
    });

    return loan.save();
  }

  async findAll(filterDto: LoanFilterDto) {
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
      this.loanModel
        .find(query)
        .populate('employee', 'firstName lastName email employeeId')
        .populate('approvedBy', 'firstName lastName email employeeId')
        .populate('disbursedBy', 'firstName lastName email employeeId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.loanModel.countDocuments(query),
    ]);

    return { data, total };
  }

  async findOne(id: string): Promise<Loan> {
    const loan = await this.loanModel
      .findById(id)
      .populate('employee', 'firstName lastName email employeeId')
      .populate('approvedBy', 'firstName lastName email employeeId')
      .populate('disbursedBy', 'firstName lastName email employeeId');

    if (!loan) {
      throw new NotFoundException(`Loan #${id} not found`);
    }

    return loan;
  }

  async updateStatus(
    id: string,
    adminId: string,
    updateLoanStatusDto: UpdateLoanStatusDto,
  ): Promise<Loan> {
    const loan = await this.findOne(id);

    // Validate status transition
    this.validateStatusTransition(loan.status, updateLoanStatusDto.status);

    const update: any = {
      status: updateLoanStatusDto.status,
      comments: updateLoanStatusDto.comments,
    };

    // Add approval or disbursement details
    if (updateLoanStatusDto.status === 'approved') {
      update.approvedBy = new Types.ObjectId(adminId);
      update.approvedDate = new Date();
    } else if (updateLoanStatusDto.status === 'disbursed') {
      update.disbursedBy = new Types.ObjectId(adminId);
      update.disbursedDate = new Date();
    }

    return this.loanModel
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
      disbursed: [],
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition loan from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  async findByEmployee(employeeId: string): Promise<Loan[]> {
    return this.loanModel
      .find({ employee: new Types.ObjectId(employeeId) })
      .populate('approvedBy', 'firstName lastName email employeeId')
      .populate('disbursedBy', 'firstName lastName email employeeId')
      .sort({ createdAt: -1 });
  }

  async getLoanStatistics() {
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

    const stats = await this.loanModel.aggregate(pipeline);
    return stats.reduce((acc: any, curr) => {
      acc[curr._id] = {
        count: curr.count,
        totalAmount: curr.totalAmount,
        averageAmount: curr.averageAmount,
      };
      return acc;
    }, {});
  }
}
