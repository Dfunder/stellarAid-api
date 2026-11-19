import { Controller, Get, Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/** #1094: log method, URL, status and duration. No headers/bodies, so no sensitive data. */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    res.on('finish', () => {
      this.logger.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  }
}

/** #1096: GET /version -> name/version from npm env, with safe fallbacks. */
@Controller('version')
export class VersionController {
  @Get()
  getVersion() {
    return {
      name: process.env.npm_package_name ?? 'stellaraid-api',
      version: process.env.npm_package_version ?? '0.0.1',
      environment: process.env.NODE_ENV ?? 'development',
    };
  }
}

/**
 * #1095: optional Swagger UI at /docs. Requires `@nestjs/swagger` to be installed;
 * skipped (with a warning) if it is missing. Call from main.ts: setupSwagger(app).
 */
export function setupSwagger(app: INestApplication): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
    const { DocumentBuilder, SwaggerModule } = require('@nestjs/swagger');
    const config = new DocumentBuilder().setTitle('StellarAid API').setVersion('0.0.1').build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  } catch {
    new Logger('Swagger').warn('@nestjs/swagger not installed; API docs disabled');
  }
}
