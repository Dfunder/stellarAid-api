import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class QueryLogger implements OnModuleInit {
  private readonly logger = new Logger('QueryLogger');
  private readonly slowQueryThreshold = 500; // ms

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.prisma.$on('query', (event) => {
      if (event.duration > this.slowQueryThreshold) {
        this.logger.warn(`Slow query (${event.duration}ms): ${event.query}`);
      } else {
        this.logger.log(`Query (${event.duration}ms): ${event.query}`);
      }
    });
  }
}
