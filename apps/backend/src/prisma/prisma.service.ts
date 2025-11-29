import { Injectable, OnModuleInit, OnModuleDestroy, INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    console.log('✅ Conexão com banco de dados estabelecida');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('🔌 Conexão com banco de dados encerrada');
  }

  async enableShutdownHooks(app: INestApplication) {
    // Prisma 5+ não suporta mais beforeExit hook
    // O graceful shutdown é feito via onModuleDestroy
    process.on('SIGTERM', async () => {
      console.log('🛑 SIGTERM recebido, iniciando graceful shutdown...');
      await app.close();
    });

    process.on('SIGINT', async () => {
      console.log('🛑 SIGINT recebido, iniciando graceful shutdown...');
      await app.close();
    });
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }
    
    const models = Reflect.ownKeys(this).filter(
      key => key[0] !== '_' && key[0] !== '$'
    );
    
    return Promise.all(models.map(modelKey => this[modelKey].deleteMany()));
  }
}
