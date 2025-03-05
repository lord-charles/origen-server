import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MpesaTransaction } from '../schemas/mpesa.schema';

interface AuditQueryParams {
  startDate?: string;
  endDate?: string;
  page: number;
  limit: number;
}

interface Employee {
  email: string;
  nationalId: string;
}

interface PopulatedMpesaTransaction extends Omit<MpesaTransaction, 'employee'> {
  employee: Employee;
}

@Injectable()
export class MpesaAuditService {
  private readonly logger = new Logger(MpesaAuditService.name);

  constructor(
    @InjectModel(MpesaTransaction.name)
    private mpesaModel: Model<MpesaTransaction>,
  ) {}

  async getTransactionAudit(params: AuditQueryParams) {
    try {
      const { startDate, endDate, page = 1, limit = 10 } = params;
      const skip = (page - 1) * limit;

      const query: any = {
        status: 'completed',
      };

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) {
          query.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
          query.createdAt.$lte = new Date(endDate);
        }
      }

      const transactions = await this.mpesaModel
        .find(query)
        .populate<{ employee: Employee }>('employee', 'email nationalId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean() as PopulatedMpesaTransaction[];

      const total = await this.mpesaModel.countDocuments(query);

      const transformedTransactions = transactions.map((transaction) => {
        // Extract names from receiverPartyPublicName
        const [phoneNumber, fullName] = (transaction.receiverPartyPublicName || '')
          .split(' - ')
          .map(part => part.trim());

        // Calculate balance before transaction
        const balanceBeforeTransaction = 
          (transaction.b2cUtilityAccountFunds || 0) + (transaction.amount || 0);

        return {
          transactionId: transaction.transactionId,
          mpesaReceiptNumber: transaction.mpesaReceiptNumber,
          transactionDate: transaction.createdAt,
          amount: transaction.amount,
          balanceBeforeTransaction,
          balanceAfterTransaction: transaction.b2cUtilityAccountFunds,
          recipientDetails: {
            name: fullName || 'N/A',
            phoneNumber: transaction.phoneNumber,
          },
          employee: {
            email: transaction.employee?.email || 'N/A',
            nationalId: transaction.employee?.nationalId || 'N/A',
          },
          status: transaction.status,
          type: transaction.transactionType,
        };
      });

      return {
        data: {
          transactions: transformedTransactions,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      this.logger.error('Error fetching transaction audit:', error);
      throw error;
    }
  }
}
