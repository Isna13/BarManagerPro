import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') || '';
    const startTime = Date.now();

    // 🔧 CORREÇÃO: Capturar tamanho real do body (não apenas header)
    // O header content-length pode não estar definido com compressão ativa
    let responseSize = 0;
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);
    
    res.write = function (chunk: any, ...args: any[]): boolean {
      if (chunk) {
        responseSize += Buffer.byteLength(chunk);
      }
      return originalWrite(chunk, ...args);
    };

    res.end = function (chunk?: any, ...args: any[]): Response {
      if (chunk) {
        responseSize += Buffer.byteLength(chunk);
      }
      return originalEnd(chunk, ...args);
    };

    res.on('finish', () => {
      const { statusCode } = res;
      const contentLength = res.get('content-length');
      const responseTime = Date.now() - startTime;
      
      // Usar tamanho real capturado, ou fallback para header
      const size = responseSize || parseInt(contentLength || '0', 10);
      const sizeStr = size > 1024 ? `${(size / 1024).toFixed(1)}kb` : `${size}b`;

      const logMessage = `${method} ${originalUrl} ${statusCode} ${sizeStr} - ${responseTime}ms - ${ip}`;

      if (statusCode >= 500) {
        this.logger.error(logMessage);
      } else if (statusCode >= 400) {
        this.logger.warn(logMessage);
      } else {
        this.logger.log(logMessage);
      }
    });

    next();
  }
}
