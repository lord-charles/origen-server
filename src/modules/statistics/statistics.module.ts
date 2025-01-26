import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Advance, AdvanceSchema } from '../advance/schemas/advance.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { StatisticsController } from './controllers/statistics.controller';
import { StatisticsService } from './services/statistics.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Advance.name, schema: AdvanceSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [StatisticsController],
  providers: [StatisticsService],
  exports: [StatisticsService],
})
export class StatisticsModule {}
