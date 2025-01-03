import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdvanceController } from './advance.controller';
import { AdvanceService } from './advance.service';
import { Advance, AdvanceSchema } from './schemas/advance.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Advance.name, schema: AdvanceSchema }]),
  ],
  controllers: [AdvanceController],
  providers: [AdvanceService],
  exports: [AdvanceService],
})
export class AdvanceModule {}
