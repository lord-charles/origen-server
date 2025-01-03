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

@Injectable()
export class AdvanceService {
  constructor(
    @InjectModel(Advance.name)
    private readonly advanceModel: Model<AdvanceDocument>,
  ) {}

  async create(
    employeeId: string,
    createAdvanceDto: CreateAdvanceDto,
  ): Promise<Advance> {
    // Calculate advance details
    const interestRate = 5; // 5% interest rate for advances
    const amount = createAdvanceDto.amount;
    const repaymentPeriod = createAdvanceDto.repaymentPeriod;

    // Calculate total repayment and installment amount
    const totalInterest = (amount * interestRate * repaymentPeriod) / 1200; // Monthly interest
    const totalRepayment = amount + totalInterest;
    const installmentAmount = totalRepayment / repaymentPeriod;

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
      disbursed: [],
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
}
