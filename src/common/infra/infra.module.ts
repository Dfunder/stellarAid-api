import { Controller, Get, Injectable, MiddlewareConsumer, Module, NestMiddleware, NestModule } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

/** #1108: propagate or generate X-Request-Id and echo it on the response. */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers['x-request-id'];
    const id = typeof incoming === 'string' && incoming ? incoming : randomUUID();
    req.headers['x-request-id'] = id;
    res.setHeader('X-Request-Id', id);
    next();
  }
}

/** #1107: liveness vs readiness. Readiness can later add DB/Redis checks. */
@Controller('health')
export class HealthController {
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  ready() {
    // Add dependency checks (DB, Redis) here as they are introduced.
    return { status: 'ok', checks: {} };
  }
}

/** #1106: Redis config scaffold (env-driven, no client dependency yet). */
@Injectable()
export class RedisConfigService {
  readonly url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  readonly enabled = process.env.REDIS_ENABLED === 'true';
}

@Module({
  controllers: [HealthController],
  providers: [RedisConfigService],
  exports: [RedisConfigService],
})
export class InfraModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
