import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as bodyParser from 'body-parser';
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

  // ============================================================
  // 🔐 TRUST PROXY - DEVE SER CONFIGURADO PRIMEIRO!
  // Railway/Heroku/etc injetam X-Forwarded-For
  // Isso DEVE vir ANTES de qualquer middleware, especialmente rate-limit
  // ============================================================
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', true); // true = confia em qualquer proxy (Railway)

  // ============================================================
  // 📦 BODY PARSER - Limite de 100MB para backups grandes
  // ============================================================
  app.use(bodyParser.json({ limit: '100mb' }));
  app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));

  // ============================================================
  // 🛡️ HELMET - Segurança HTTP
  // ============================================================
  app.use(helmet({
    contentSecurityPolicy: nodeEnv === 'production',
    crossOriginEmbedderPolicy: nodeEnv === 'production',
  }));
  
  // ============================================================
  // 📦 COMPRESSION - Compressão de respostas
  // ============================================================
  app.use(compression());
  
  // ============================================================
  // ⏱️ RATE LIMITING - Proteção contra abuso
  // keyGenerator explícito usa req.ip que já considera trust proxy
  // validate: false desabilita validação que causa ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
  // ============================================================
  const limiter = rateLimit({
    windowMs: parseInt(configService.get('RATE_LIMIT_WINDOW_MS') || '60000'),
    max: parseInt(configService.get('RATE_LIMIT_MAX_REQUESTS') || '100'),
    message: 'Muitas requisições deste IP, tente novamente mais tarde.',
    standardHeaders: true,
    legacyHeaders: false,
    skipFailedRequests: true,
    // keyGenerator explícito - usa req.ip que já respeita trust proxy
    keyGenerator: (req) => {
      return req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0] || 'unknown';
    },
    // Desabilita validações que causam ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
    validate: {
      xForwardedForHeader: false,
      trustProxy: false,
    },
  });
  app.use(limiter);

  // ============================================================
  // 🌐 CORS - Cross-Origin Resource Sharing
  // ============================================================
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
      forbidNonWhitelisted: false,
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
