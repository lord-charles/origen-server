import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WalletTransactionController } from './controllers/wallet-transaction.controller';
import { WalletTransactionService } from './services/wallet-transaction.service';
import {
  WalletTransaction,
  WalletTransactionSchema,
} from './schemas/wallet-transaction.schema';
import { WalletPaymentController } from './controllers/wallet-payment.controller';
import { WalletPaymentService } from './services/wallet-payment.service';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { MpesaService } from '../mpesa/services/mpesa.service';
import { NotificationService } from '../notifications/services/notification.service';
import {
  MpesaTransaction,
  MpesaTransactionSchema,
} from '../mpesa/schemas/mpesa.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WalletTransaction.name, schema: WalletTransactionSchema },
      { name: User.name, schema: UserSchema },
      { name: MpesaTransaction.name, schema: MpesaTransactionSchema },
    ]),
  ],
  controllers: [WalletTransactionController, WalletPaymentController],
  providers: [
    WalletTransactionService,
    WalletPaymentService,
    MpesaService,
    NotificationService,
  ],
  exports: [WalletTransactionService, WalletPaymentService],
})
export class WalletModule {}
