import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { LoggerMiddleware } from './common/middleware/logger.middleware';

// Core modules
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BranchesModule } from './branches/branches.module';

// Business modules
import { ProductsModule } from './products/products.module';
import { CategoriesModule } from './categories/categories.module';
import { InventoryModule } from './inventory/inventory.module';
import { SalesModule } from './sales/sales.module';
import { CashBoxModule } from './cash-box/cash-box.module';
import { CustomersModule } from './customers/customers.module';
import { DebtsModule } from './debts/debts.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { PurchasesModule } from './purchases/purchases.module';
import { TablesModule } from './tables/tables.module';
import { TableSessionsModule } from './table-sessions/table-sessions.module';

// Advanced features
import { ForecastModule } from './forecast/forecast.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { FeedbackModule } from './feedback/feedback.module';
import { QrMenuModule } from './qr-menu/qr-menu.module';

// Infrastructure
import { SyncModule } from './sync/sync.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';
import { BackupModule } from './backup/backup.module';
import { AuditModule } from './audit/audit.module';
import { WebSocketModule } from './websocket/websocket.module';
import { HealthModule } from './health/health.module';
import { ImportModule } from './import/import.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
      },
    }),
    
    // Core
    PrismaModule,
    AuthModule,
    UsersModule,
    BranchesModule,
    
    // Business
    ProductsModule,
    CategoriesModule,
    InventoryModule,
    SalesModule,
    CashBoxModule,
    CustomersModule,
    DebtsModule,
    SuppliersModule,
    PurchasesModule,
    TablesModule,
    TableSessionsModule,
    
    // Advanced
    ForecastModule,
    LoyaltyModule,
    CampaignsModule,
    FeedbackModule,
    QrMenuModule,
    
    // Infrastructure
    SyncModule,
    NotificationsModule,
    ReportsModule,
    BackupModule,
    AuditModule,
    WebSocketModule,
    HealthModule,
    ImportModule,
    SettingsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes('*'); // Aplicar logging em todas as rotas
  }
}
