import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@ApiTags('Health')
@Controller({ version: '1', path: 'health' })
export class HealthController {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
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
    } catch (e) {
      dbStatus = 'down';
    }

    try {
      const ping = await this.redisService.ping();
      if (ping === 'PONG' || ping) {
        redisStatus = 'up';
      }
    } catch (e) {
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
