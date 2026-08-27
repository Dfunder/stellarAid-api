import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@Controller({ version: '1', path: 'health' })
export class HealthController {
  constructor(
    private readonly prismaService: PrismaService,
    @Inject('RedisClient') private readonly redisClient: Redis,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Check DB and Redis connectivity status' })
  @ApiResponse({ status: 200, description: 'Health status of DB and Redis' })
  async checkHealth() {
    let dbStatus = 'down';
    let redisStatus = 'down';

    try {
      await this.prismaService.$queryRaw`SELECT 1`;
      dbStatus = 'up';
    } catch {
      dbStatus = 'down';
    }

    try {
      const ping = await this.redisClient.ping();
      if (ping === 'PONG' || ping) {
        redisStatus = 'up';
      }
    } catch {
      redisStatus = 'down';
    }

    const isHealthy = dbStatus === 'up' && redisStatus === 'up';

    return {
      status: isHealthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
    };
  }
}
