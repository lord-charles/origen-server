import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdvanceController } from './controllers/advance.controller';
import { AdvanceService } from './services/advance.service';
import { AdvancePaymentService } from './services/advance-payment.service';
import { AdvancePaymentController } from './controllers/advance-payment.controller';
import { Advance, AdvanceSchema } from './schemas/advance.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { SystemConfig, SystemConfigSchema } from '../system-config/schemas/system-config.schema';
import { MpesaModule } from '../mpesa/mpesa.module';
import { WalletModule } from '../wallet/wallet.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SystemLogsModule } from '../system-logs/system-logs.module';
import { MpesaTransaction, MpesaTransactionSchema } from '../mpesa/schemas/mpesa.schema';
import { WalletTransaction, WalletTransactionSchema } from '../wallet/schemas/wallet-transaction.schema';
import { SystemLog, SystemLogSchema } from '../system-logs/schemas/system-log.schema';
import { SystemLogsService } from '../system-logs/services/system-logs.service';
import { AdvanceBatchUpdateService } from './services/advance-batch-update.service';
import { AdvanceBatchUpdateController } from './controllers/advance-batch-update.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Advance.name, schema: AdvanceSchema },
      { name: User.name, schema: UserSchema },
      { name: SystemConfig.name, schema: SystemConfigSchema },
      { name: MpesaTransaction.name, schema: MpesaTransactionSchema },
      { name: WalletTransaction.name, schema: WalletTransactionSchema },
      { name: SystemLog.name, schema: SystemLogSchema },
    ]),
    MpesaModule,
    WalletModule,
    SystemLogsModule,
    NotificationsModule,
  ],
  controllers: [AdvanceController, AdvancePaymentController, AdvanceBatchUpdateController],
  providers: [AdvanceService, AdvancePaymentService, SystemLogsService, AdvanceBatchUpdateService],
  exports: [AdvanceService, AdvancePaymentService],
})
export class AdvanceModule {}
