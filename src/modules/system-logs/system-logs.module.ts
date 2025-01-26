import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SystemLogsService } from './services/system-logs.service';
import { SystemLogsController } from './controllers/system-logs.controller';
import { SystemLog, SystemLogSchema } from './schemas/system-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SystemLog.name, schema: SystemLogSchema },
    ]),
  ],
  providers: [SystemLogsService],
  controllers: [SystemLogsController],
  exports: [SystemLogsService],
})
export class SystemLogsModule {}
