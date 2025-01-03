import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  WalletTransaction,
  WalletTransactionDocument,
} from './schemas/wallet-transaction.schema';
import {
  CreateWalletTransactionDto,
  UpdateTransactionStatusDto,
  WalletTransactionFilterDto,
} from './dto/wallet-transaction.dto';
import { generateTransactionId } from 'src/utils/transaction.utils';

@Injectable()
export class WalletTransactionService {
  constructor(
    @InjectModel(WalletTransaction.name)
    private readonly walletTransactionModel: Model<WalletTransactionDocument>,
  ) {}

  async create(
    walletId: string,
    createTransactionDto: CreateWalletTransactionDto,
  ): Promise<WalletTransaction> {
    try {
      // Generate unique transaction ID
      const transactionId = generateTransactionId();

      // Validate recipient details based on transaction type
      this.validateRecipientDetails(
        createTransactionDto.transactionType,
        createTransactionDto.recipientDetails,
      );

      // Validate wallet ID
      if (!Types.ObjectId.isValid(walletId)) {
        throw new BadRequestException('Invalid wallet ID');
      }

      // If it's a transfer to another wallet, validate recipient wallet
      if (
        createTransactionDto.transactionType === 'transfer_to_wallet' &&
        createTransactionDto.recipientDetails?.recipientWalletId
      ) {
        const recipientWalletId =
          createTransactionDto.recipientDetails.recipientWalletId;
        if (walletId === recipientWalletId.toString()) {
          throw new BadRequestException('Cannot transfer to the same wallet');
        }
      }

      // Create the transaction
      const transaction = new this.walletTransactionModel({
        ...createTransactionDto,
        walletId: new Types.ObjectId(walletId),
        transactionId,
        transactionDate: new Date(),
        status: 'pending',
      });

      const savedTransaction = await transaction.save();
      return savedTransaction;
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictException('Transaction already exists');
      }
      throw error;
    }
  }

  async findAll(filterDto: WalletTransactionFilterDto) {
    const {
      transactionType,
      status,
      walletId,
      minAmount,
      maxAmount,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = filterDto;

    const query: any = {};

    if (transactionType) {
      query.transactionType = transactionType;
    }

    if (status) {
      query.status = status;
    }

    if (walletId) {
      if (!Types.ObjectId.isValid(walletId)) {
        throw new BadRequestException('Invalid wallet ID in filter');
      }
      query.walletId = new Types.ObjectId(walletId.toString());
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
      query.transactionDate = {};
      if (startDate) {
        query.transactionDate.$gte = startDate;
      }
      if (endDate) {
        query.transactionDate.$lte = endDate;
      }
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.walletTransactionModel
        .find(query)
        .populate('walletId', 'firstName lastName email')
        .sort({ transactionDate: -1 })
        .skip(skip)
        .limit(limit),
      this.walletTransactionModel.countDocuments(query),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<WalletTransaction> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid transaction ID');
    }

    const transaction = await this.walletTransactionModel
      .findById(id)
      .populate('walletId', 'firstName lastName email');

    if (!transaction) {
      throw new NotFoundException(`Transaction #${id} not found`);
    }

    return transaction;
  }

  async findByTransactionId(transactionId: string): Promise<WalletTransaction> {
    const transaction = await this.walletTransactionModel
      .findOne({ transactionId })
      .populate('walletId', 'firstName lastName email');

    if (!transaction) {
      throw new NotFoundException(`Transaction #${transactionId} not found`);
    }

    return transaction;
  }

  async updateStatus(
    id: string,
    updateStatusDto: UpdateTransactionStatusDto,
  ): Promise<WalletTransaction> {
    try {
      const transaction = await this.findOne(id);

      // Validate status transition
      this.validateStatusTransition(transaction.status, updateStatusDto.status);

      // Update the transaction status
      const updatedTransaction = await this.walletTransactionModel
        .findByIdAndUpdate(
          id,
          {
            status: updateStatusDto.status,
            adminRemarks: updateStatusDto.adminRemarks,
          },
          { new: true },
        )
        .populate('walletId', 'firstName lastName email');

      if (!updatedTransaction) {
        throw new NotFoundException(`Transaction #${id} not found`);
      }

      return updatedTransaction;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to update transaction status');
    }
  }

  async findByWallet(walletId: string): Promise<WalletTransaction[]> {
    if (!Types.ObjectId.isValid(walletId)) {
      throw new BadRequestException('Invalid wallet ID');
    }

    return this.walletTransactionModel
      .find({ walletId: new Types.ObjectId(walletId) })
      .populate('walletId', 'firstName lastName email')
      .sort({ transactionDate: -1 });
  }

  async getTransactionStatistics(walletId?: string) {
    if (walletId && !Types.ObjectId.isValid(walletId)) {
      throw new BadRequestException('Invalid wallet ID');
    }

    const matchStage: any = {};
    if (walletId) {
      matchStage.walletId = new Types.ObjectId(walletId);
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: {
            type: '$transactionType',
            status: '$status',
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          averageAmount: { $avg: '$amount' },
        },
      },
      {
        $group: {
          _id: '$_id.type',
          stats: {
            $push: {
              status: '$_id.status',
              count: '$count',
              totalAmount: { $round: ['$totalAmount', 2] },
              averageAmount: { $round: ['$averageAmount', 2] },
            },
          },
          totalCount: { $sum: '$count' },
          totalAmount: { $round: [{ $sum: '$totalAmount' }, 2] },
        },
      },
    ];

    const stats = await this.walletTransactionModel.aggregate(pipeline);
    return stats.reduce((acc: any, curr) => {
      acc[curr._id] = {
        stats: curr.stats,
        totalCount: curr.totalCount,
        totalAmount: curr.totalAmount,
      };
      return acc;
    }, {});
  }

  private validateRecipientDetails(
    transactionType: string,
    recipientDetails?: {
      recipientWalletId?: Types.ObjectId;
      recipientMpesaNumber?: string;
    },
  ) {
    if (!recipientDetails) {
      throw new BadRequestException('Recipient details are required');
    }

    switch (transactionType) {
      case 'send_to_mpesa':
        if (!recipientDetails.recipientMpesaNumber) {
          throw new BadRequestException(
            'Recipient M-PESA number is required for M-PESA transfers',
          );
        }
        if (!/^\+254\d{9}$/.test(recipientDetails.recipientMpesaNumber)) {
          throw new BadRequestException(
            'Invalid M-PESA number format. Must be in format: +254XXXXXXXXX',
          );
        }
        break;

      case 'transfer_to_wallet':
        if (!recipientDetails.recipientWalletId) {
          throw new BadRequestException(
            'Recipient wallet ID is required for wallet transfers',
          );
        }
        if (!Types.ObjectId.isValid(recipientDetails.recipientWalletId)) {
          throw new BadRequestException('Invalid recipient wallet ID');
        }
        break;

      case 'receive_from_mpesa':
      case 'receive_from_advance':
        // No recipient details needed for these types
        break;

      default:
        throw new BadRequestException('Invalid transaction type');
    }
  }

  private validateStatusTransition(currentStatus: string, newStatus: string) {
    const validTransitions: { [key: string]: string[] } = {
      pending: ['completed', 'failed'],
      completed: [],
      failed: [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition transaction from ${currentStatus} to ${newStatus}`,
      );
    }
  }
}
