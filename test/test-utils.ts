import { PrismaService } from '../src/prisma/prisma.service';

let prisma: PrismaService;

export const getPrisma = (): PrismaService => {
  if (!prisma) {
    prisma = new PrismaService();
  }
  return prisma;
};

/**
 * Deletes all rows from every table in the public schema.
 *
 * Uses `TRUNCATE ... CASCADE` so foreign-key constraints are handled
 * automatically, guaranteeing a clean state between test runs.
 */
export const cleanup = async () => {
  const client = getPrisma();
  const tables = await client.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  const names = tables.map((t) => `"${t.tablename}"`).join(', ');
  if (names) {
    await client.$executeRawUnsafe(`TRUNCATE TABLE ${names} CASCADE`);
  }
};
