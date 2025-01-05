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

      // Initialize queries for each model
      const queries: any[] = [];

      // Add MPESA transactions
      const mpesaQuery = {
        employee: new Types.ObjectId(userId),
      };

      this.logger.debug('MPESA Query:', JSON.stringify(mpesaQuery, null, 2));

      const mpesaTransactions = this.mpesaModel
        .find(mpesaQuery)
        .select(
          'transactionType amount phoneNumber status createdAt accountReference ' +
            'callbackStatus mpesaReceiptNumber transactionId receiverPartyPublicName ' +
            'transactionCompletedDateTime',
        )
        .lean();

      this.logger.debug(`Fetching MPESA transactions for user: ${userId}`);
      const mpesaResults = await mpesaTransactions.exec();
      this.logger.debug(
        'Raw MPESA Results:',
        JSON.stringify(mpesaResults, null, 2),
      );

      // Log each transaction type we found
      mpesaResults.forEach((tx) => {
        this.logger.debug(
          `Found transaction type: ${tx.transactionType}, status: ${tx.status}, id: ${tx._id}`,
        );
      });

      queries.push(Promise.resolve(mpesaResults));

      // Add Wallet transactions
      const walletTransactions = this.walletModel
        .find({
          $or: [
            { walletId: new Types.ObjectId(userId) },
            {
              'recipientDetails.recipientWalletId': new Types.ObjectId(userId),
            },
          ],
        })
        .select(
          'transactionType amount status transactionDate description recipientDetails transactionId',
        )
        .lean()
        .exec();

      queries.push(walletTransactions);

      // Add Loan transactions
      const loanTransactions = this.loanModel
        .find({ employee: userId })
        .select(
          'amount purpose status requestedDate disbursedDate installmentAmount',
        )
        .lean()
        .exec();

      queries.push(loanTransactions);

      // Execute all queries
      const allTransactions = await Promise.all(queries);

      // Merge and transform transactions
      const mergedTransactions = allTransactions
        .flat()
        .map((transaction) => {
          let transformedTransaction: any = {
            ...transaction,
            id: transaction._id,
            type: this.determineTransactionType(transaction),
            reason: this.determineTransactionReason(transaction),
            date:
              transaction.createdAt ||
              transaction.transactionDate ||
              transaction.requestedDate,
          };
          delete transformedTransaction._id;
          return transformedTransaction;
        })
        .sort((a, b) => b.date.getTime() - a.date.getTime());

      // Apply pagination
      const total = mergedTransactions.length;
      const paginatedTransactions = mergedTransactions.slice(
        skip,
        skip + limit,
      );

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      return {
        success: true,
        data: {
          transactions: paginatedTransactions,
          pagination: {
            total,
            page,
            limit,
            totalPages,
            hasNextPage,
            hasPreviousPage,
          },
        },
      };
    } catch (error) {
      this.logger.error('Error fetching recent transactions:', error);
      throw error;
    }
  }

  private determineTransactionType(transaction: any): TransactionType {
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
    if (transaction.purpose) return TransactionType.LOAN_DISBURSEMENT;
    return null;
  }

  private determineTransactionReason(transaction: any): string {
    // For loans, use the purpose field
    if (transaction.purpose) {
      return transaction.purpose;
    }

    // For wallet transactions, use the description
    if (transaction.description) {
      return transaction.description;
    }

    // For M-Pesa transactions, use the account reference
    if (transaction.accountReference) {
      return transaction.accountReference;
    }

    // For transactions without a specific reason
    return transaction.transactionType || 'Unknown';
  }
}
