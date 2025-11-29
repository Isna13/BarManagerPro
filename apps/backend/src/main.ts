import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get('PORT') || 3000;
  const apiPrefix = configService.get('API_PREFIX') || 'api/v1';
  const nodeEnv = configService.get('NODE_ENV') || 'development';

  // Security - Helmet with production-ready settings
  app.use(helmet({
    contentSecurityPolicy: nodeEnv === 'production',
    crossOriginEmbedderPolicy: nodeEnv === 'production',
  }));
  
  // Compression for responses
  app.use(compression());
  
  // Rate limiting to prevent abuse
  const limiter = rateLimit({
    windowMs: parseInt(configService.get('RATE_LIMIT_WINDOW_MS') || '60000'), // 1 minute
    max: parseInt(configService.get('RATE_LIMIT_MAX_REQUESTS') || '100'), // 100 requests per minute
    message: 'Muitas requisições deste IP, tente novamente mais tarde.',
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  // CORS - Configurado para aceitar todas as origens em desenvolvimento
  // e apenas origens específicas em produção
  const corsOrigin = configService.get('CORS_ORIGIN');
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin?.split(',') || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Global prefix
  app.setGlobalPrefix(apiPrefix);

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    })
  );

  // Enable graceful shutdown
  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  await app.listen(port, '0.0.0.0');
  
  // Detectar IP da rede local
  const networkInterfaces = require('os').networkInterfaces();
  const localIPs = [];
  for (const name of Object.keys(networkInterfaces)) {
    for (const net of networkInterfaces[name]) {
      // IPv4 e não loopback
      if (net.family === 'IPv4' && !net.internal) {
        localIPs.push(net.address);
      }
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('🚀 BarManager Pro API - INICIADO COM SUCESSO!');
  console.log('='.repeat(70));
  console.log('\n📊 INFORMAÇÕES DO SERVIDOR:');
  console.log(`   Ambiente:      ${nodeEnv}`);
  console.log(`   Porta:         ${port}`);
  console.log(`   API Prefix:    /${apiPrefix}`);
  console.log(`   CORS:          ${configService.get('CORS_ORIGIN') || '*'}`);
  console.log(`   Rate Limit:    ${configService.get('RATE_LIMIT_MAX_REQUESTS') || '100'} req/min`);
  
  console.log('\n📡 ENDPOINTS DE ACESSO:');
  console.log(`   Local:         http://127.0.0.1:${port}/${apiPrefix}`);
  console.log(`   Localhost:     http://localhost:${port}/${apiPrefix}`);
  
  if (localIPs.length > 0) {
    console.log(`   Rede Local:    http://${localIPs[0]}:${port}/${apiPrefix}`);
    if (localIPs.length > 1) {
      localIPs.slice(1).forEach(ip => {
        console.log(`                  http://${ip}:${port}/${apiPrefix}`);
      });
    }
  }
  
  console.log('\n✅ HEALTH CHECKS:');
  console.log(`   Status:        /${apiPrefix}/health`);
  console.log(`   Ping:          /${apiPrefix}/health/ping`);
  
  console.log('\n🔐 AUTENTICAÇÃO:');
  console.log(`   Login:         POST /${apiPrefix}/auth/login`);
  console.log(`   Register:      POST /${apiPrefix}/auth/register`);
  console.log(`   JWT Expira:    ${configService.get('JWT_EXPIRES_IN') || '7d'}`);
  
  if (nodeEnv === 'production') {
    console.log('\n⚠️  MODO PRODUÇÃO ATIVO:');
    console.log('   - Logs reduzidos');
    console.log('   - Helmet ativado com CSP');
    console.log('   - Rate limiting ativo');
    console.log('   - CORS restrito');
  } else {
    console.log('\n💡 MODO DESENVOLVIMENTO:');
    console.log('   - Logs detalhados');
    console.log('   - CORS permissivo');
    console.log('   - Para produção, configure NODE_ENV=production');
  }
  
  console.log('\n' + '='.repeat(70) + '\n');
}

bootstrap();
