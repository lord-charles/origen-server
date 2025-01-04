import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdvanceController } from './advance.controller';
import { AdvanceService } from './advance.service';
import { Advance, AdvanceSchema } from './schemas/advance.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Advance.name, schema: AdvanceSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [AdvanceController],
  providers: [AdvanceService],
  exports: [AdvanceService],
})
export class AdvanceModule {}
