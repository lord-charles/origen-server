import { forwardRef, Module } from '@nestjs/common';
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
import { MpesaModule } from '../mpesa/mpesa.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WalletTransaction.name, schema: WalletTransactionSchema },
      { name: User.name, schema: UserSchema },
    ]),
    forwardRef(() => MpesaModule),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [WalletTransactionController, WalletPaymentController],
  providers: [
    WalletTransactionService,
    WalletPaymentService,
  ],
  exports: [WalletTransactionService, WalletPaymentService],
})
export class WalletModule {}
