import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma service with connection pooling configuration (#655).
 *
 * Pool size is driven by environment variables so it can be tuned per
 * deployment without a code change:
 *   DATABASE_CONNECTION_LIMIT  — max connections in the pool (default 10)
 *   DATABASE_CONNECT_TIMEOUT   — seconds to wait for a free connection (default 10)
 *
 * The connection string can include ?connection_limit=N&connect_timeout=N
 * as Prisma connection URL parameters.  We also set them via the datasource
 * url string at construction time as a belt-and-suspenders approach.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionLimit = parseInt(process.env.DATABASE_CONNECTION_LIMIT ?? '10', 10);
    const connectTimeout = parseInt(process.env.DATABASE_CONNECT_TIMEOUT ?? '10', 10);

    const databaseUrl = process.env.DATABASE_URL ?? '';
    // Append pool params if not already present in the URL
    const poolUrl = databaseUrl.includes('connection_limit')
      ? databaseUrl
      : `${databaseUrl}${databaseUrl.includes('?') ? '&' : '?'}connection_limit=${connectionLimit}&connect_timeout=${connectTimeout}`;

    super({
      datasources: { db: { url: poolUrl } },
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connection pool established');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database connection pool closed');
  }
}
