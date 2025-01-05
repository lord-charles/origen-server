import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  MpesaTransaction,
  MpesaTransactionSchema,
} from './schemas/mpesa.schema';
import { User, UserSchema } from 'src/modules/auth/schemas/user.schema';
import { AuthModule } from 'src/modules/auth/auth.module';
import { MpesaController } from './controllers/mpesa.controller';
import { MpesaService } from './services/mpesa.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MpesaTransaction.name, schema: MpesaTransactionSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuthModule,
  ],
  controllers: [MpesaController],
  providers: [MpesaService],
  exports: [MpesaService],
})
export class MpesaModule {}
