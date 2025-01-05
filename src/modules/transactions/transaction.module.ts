import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TransactionController } from './controllers/transaction.controller';
import { TransactionService } from './services/transaction.service';
import {
  MpesaTransaction,
  MpesaTransactionSchema,
} from '../mpesa/schemas/mpesa.schema';
import {
  WalletTransaction,
  WalletTransactionSchema,
} from '../wallet/schemas/wallet-transaction.schema';
import { Loan, LoanSchema } from '../loans/schemas/loan.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MpesaTransaction.name, schema: MpesaTransactionSchema },
      { name: WalletTransaction.name, schema: WalletTransactionSchema },
      { name: Loan.name, schema: LoanSchema },
    ]),
  ],
  controllers: [TransactionController],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionModule {}
