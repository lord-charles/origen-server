import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { AdvanceModule } from './modules/advance/advance.module';
import { LoansModule } from './modules/loans/loans.module';
import { MpesaModule } from './modules/mpesa/mpesa.module';
import { DatabaseModule } from './database/database.module';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { TransactionModule } from './modules/transactions/transaction.module';
import { SystemConfigModule } from './modules/system-config/system-config.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { SystemLogsModule } from './modules/system-logs/system-logs.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuthModule,
    WalletModule,
    AdvanceModule,
    LoansModule,
    MpesaModule,
    DatabaseModule,
    TransactionModule,
    SystemConfigModule,
    NotificationsModule,
    StatisticsModule,
    SystemLogsModule,
    ReportsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
