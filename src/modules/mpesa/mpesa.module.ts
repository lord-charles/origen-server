import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  MpesaTransaction,
  MpesaTransactionSchema,
} from './schemas/mpesa.schema';
import { User, UserSchema } from 'src/modules/auth/schemas/user.schema';
import { AuthModule } from 'src/modules/auth/auth.module';
import { MpesaController } from './controllers/mpesa.controller';
import { MpesaService } from './services/mpesa.service';
import { WalletModule } from 'src/modules/wallet/wallet.module';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';
import { Advance, AdvanceSchema } from 'src/modules/advance/schemas/advance.schema';
import { SystemConfig, SystemConfigSchema } from 'src/modules/system-config/schemas/system-config.schema';
import { MpesaAuditService } from './services/mpesa-audit.service';
import { MpesaAuditController } from './controllers/mpesa-audit.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MpesaTransaction.name, schema: MpesaTransactionSchema },
      { name: User.name, schema: UserSchema },
      { name: Advance.name, schema: AdvanceSchema },
      { name: SystemConfig.name, schema: SystemConfigSchema },
    ]),
    AuthModule,
    forwardRef(() => WalletModule),
    NotificationsModule,
  ],
  controllers: [MpesaController, MpesaAuditController],
  providers: [MpesaService, MpesaAuditService],
  exports: [MpesaService],
})
export class MpesaModule {}
