import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Cache em memória para chaves de idempotência
 * Em produção, considere usar Redis para persistência entre instâncias
 */
const idempotencyCache = new Map<string, { response: any; timestamp: number }>();

// Limpar cache a cada 5 minutos (chaves expiradas)
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minuto

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of idempotencyCache.entries()) {
    if (now - value.timestamp > CACHE_TTL_MS) {
      idempotencyCache.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Só verificar idempotência para POST, PUT, PATCH
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
      return next();
    }

    const idempotencyKey = req.headers['x-idempotency-key'] as string;
    
    // Se não tem chave, continuar normalmente
    if (!idempotencyKey) {
      return next();
    }

    // Verificar se já processamos essa chave
    const cached = idempotencyCache.get(idempotencyKey);
    if (cached) {
      console.log(`🔑 [Idempotency] Requisição duplicada detectada: ${idempotencyKey}`);
      console.log(`   Retornando resposta em cache (status: ${cached.response.statusCode || 200})`);
      
      // Retornar resposta em cache
      return res.status(cached.response.statusCode || 200).json(cached.response.body);
    }

    // Capturar a resposta para cachear
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      // Cachear resposta bem-sucedida
      if (res.statusCode >= 200 && res.statusCode < 300) {
        idempotencyCache.set(idempotencyKey, {
          response: { body, statusCode: res.statusCode },
          timestamp: Date.now(),
        });
        console.log(`🔑 [Idempotency] Resposta cacheada para: ${idempotencyKey}`);
      }
      return originalJson(body);
    };

    next();
  }
}

/**
 * Estatísticas do cache de idempotência (para monitoramento)
 */
export function getIdempotencyCacheStats() {
  return {
    size: idempotencyCache.size,
    keys: Array.from(idempotencyCache.keys()).slice(0, 10), // Apenas primeiras 10
  };
}
