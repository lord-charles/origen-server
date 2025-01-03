import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MpesaController } from './controllers/mpesa.controller';
import { MpesaService } from './services/mpesa.service';
import {
  MpesaTransaction,
  MpesaTransactionSchema,
} from './schemas/mpesa.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MpesaTransaction.name, schema: MpesaTransactionSchema },
    ]),
  ],
  controllers: [MpesaController],
  providers: [MpesaService],
  exports: [MpesaService],
})
export class MpesaModule {}
