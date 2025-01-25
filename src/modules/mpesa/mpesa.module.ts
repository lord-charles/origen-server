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

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MpesaTransaction.name, schema: MpesaTransactionSchema },
      { name: User.name, schema: UserSchema },
      { name: Advance.name, schema: AdvanceSchema },
    ]),
    AuthModule,
    forwardRef(() => WalletModule),
    NotificationsModule,
  ],
  controllers: [MpesaController],
  providers: [MpesaService],
  exports: [MpesaService],
})
export class MpesaModule {}
