import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MpesaTransaction } from '../../mpesa/schemas/mpesa.schema';
import { WalletTransaction } from '../../wallet/schemas/wallet-transaction.schema';
import { Loan } from '../../loans/schemas/loan.schema';
import { TransactionType } from '../dto/transaction.dto';

interface PaginationParams {
  page: number;
  limit: number;
}

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(
    @InjectModel(MpesaTransaction.name)
    private mpesaModel: Model<MpesaTransaction>,
    @InjectModel(WalletTransaction.name)
    private walletModel: Model<WalletTransaction>,
    @InjectModel(Loan.name)
    private loanModel: Model<Loan>,
  ) {}

  async getRecentTransactions(userId: string, pagination: PaginationParams) {
    try {
      const { page = 1, limit = 10 } = pagination;
      const skip = (page - 1) * limit;
      const userObjectId = new Types.ObjectId(userId);

      // Fetch all transactions in parallel
      const [mpesaTransactions, walletTransactions, loanTransactions] =
        await Promise.all([
          // Fetch all MPESA transactions (both paybill and b2c)
          this.mpesaModel
            .find({
              employee: userObjectId,
            })
            .select(
              'transactionType amount phoneNumber status createdAt accountReference transactionId',
            )
            .lean()
            .exec(),

          // Fetch wallet transactions
          this.walletModel
            .find({
              $or: [
                { walletId: userObjectId },
                { 'recipientDetails.recipientWalletId': userObjectId },
              ],
            })
            .select(
              'transactionType amount status transactionDate description recipientDetails transactionId',
            )
            .lean()
            .exec(),

          // Fetch loan transactions
          this.loanModel
            .find({ employee: userObjectId })
            .select(
              'amount purpose status requestedDate disbursedDate installmentAmount',
            )
            .lean()
            .exec(),
        ]);

      const transformedTransactions = [
        // Transform MPESA transactions
        ...mpesaTransactions.map((transaction) => ({
          ...transaction,
          _id: transaction._id?.toString(),
          accountReference:
            transaction.transactionId || transaction.accountReference,
          type: this.determineTransactionType(transaction),
          reason: transaction.transactionId || transaction.accountReference,
          date: transaction.createdAt,
          amount: transaction.amount,
          status: transaction.status,
        })),

        // Transform wallet transactions
        ...walletTransactions.map((transaction) => {
          // Get recipient details safely
          const recipientDetails = transaction.recipientDetails || {};
          const recipientId = recipientDetails.recipientWalletId;
          const recipientPhone = recipientDetails.recipientMpesaNumber;

          return {
            ...transaction,
            _id: transaction._id?.toString(),
            accountReference:
              transaction.transactionId || transaction.description || 'N/A',
            phoneNumber: recipientId
              ? recipientId.toString()
              : recipientPhone || 'N/A',
            type: this.determineTransactionType(transaction),
            reason: transaction.description || 'N/A',
            date: transaction.transactionDate,
            amount: transaction.amount,
            status: transaction.status,
          };
        }),

        // Transform loan transactions
        ...loanTransactions.map((transaction) => ({
          ...transaction,
          _id: transaction._id?.toString(),
          type: TransactionType.LOAN_DISBURSEMENT,
          reason: transaction.purpose,
          date: transaction.requestedDate,
          amount: transaction.amount,
          status: transaction.status,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Apply pagination
      const total = transformedTransactions.length;
      const paginatedTransactions = transformedTransactions.slice(
        skip,
        skip + limit,
      );

      return {
        success: true,
        data: {
          transactions: paginatedTransactions,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            hasNextPage: page < Math.ceil(total / limit),
            hasPreviousPage: page > 1,
          },
        },
      };
    } catch (error) {
      this.logger.error('Error fetching recent transactions:', error);
      throw error;
    }
  }

  private determineTransactionType(transaction: any): TransactionType {
    if (!transaction) return null;
    if (transaction.transactionType === 'paybill')
      return TransactionType.MPESA_PAYBILL;
    if (transaction.transactionType === 'b2c') return TransactionType.MPESA_B2C;
    if (transaction.transactionType === 'send_to_mpesa')
      return TransactionType.WALLET_SEND_TO_MPESA;
    if (transaction.transactionType === 'receive_from_mpesa')
      return TransactionType.WALLET_RECEIVE_FROM_MPESA;
    if (transaction.transactionType === 'transfer_to_wallet')
      return TransactionType.WALLET_TRANSFER;
    if (transaction.transactionType === 'receive_from_advance')
      return TransactionType.WALLET_RECEIVE_ADVANCE;
    if (transaction.transactionType === 'withdrawal')
      return TransactionType.WALLET_WITHDRAWAL;
    if (transaction.purpose) return TransactionType.LOAN_DISBURSEMENT;
    return null;
  }

}



