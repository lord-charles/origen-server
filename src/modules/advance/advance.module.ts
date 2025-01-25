import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdvanceController } from './controllers/advance.controller';
import { AdvanceService } from './services/advance.service';
import { Advance, AdvanceSchema } from './schemas/advance.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';
import {
  SystemConfig,
  SystemConfigSchema,
} from '../system-config/schemas/system-config.schema';
import { AdvancePaymentService } from './services/advance-payment.service';
import { AdvancePaymentController } from './controllers/advance-payment.controller';
import { MpesaModule } from '../mpesa/mpesa.module';
import { WalletModule } from '../wallet/wallet.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationService } from '../notifications/services/notification.service';
import {
  MpesaTransaction,
  MpesaTransactionSchema,
} from '../mpesa/schemas/mpesa.schema';
import {
  WalletTransaction,
  WalletTransactionSchema,
} from '../wallet/schemas/wallet-transaction.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Advance.name, schema: AdvanceSchema },
      { name: User.name, schema: UserSchema },
      { name: SystemConfig.name, schema: SystemConfigSchema },
      { name: MpesaTransaction.name, schema: MpesaTransactionSchema },
      { name: WalletTransaction.name, schema: WalletTransactionSchema },
    ]),
    MpesaModule,
    WalletModule,
    NotificationsModule,
  ],
  controllers: [AdvanceController, AdvancePaymentController],
  providers: [AdvanceService, AdvancePaymentService, NotificationService],
  exports: [AdvanceService],
})
export class AdvanceModule {}
