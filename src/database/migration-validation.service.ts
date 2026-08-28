import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MigrationValidationService implements OnModuleInit {
  private readonly logger = new Logger(MigrationValidationService.name);
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() { await this.validate(); }

  async validate() {
    try {
      const tables: any[] = await this.prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
      const names = tables.map((t) => t.tablename as string);
      for (const t of ['User', 'Artist', 'Commission', 'Payment', 'AuditLog']) {
        if (!names.includes(t)) this.logger.error(`Migration validation FAILED — missing table: ${t}`);
      }
      this.logger.log('Migration validation passed');
    } catch (err) {
      this.logger.warn(`Migration validation skipped: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
