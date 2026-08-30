import { PrismaService } from '../src/prisma/prisma.service';

let prisma: PrismaService;

export const getPrisma = (): PrismaService => {
  if (!prisma) {
    prisma = new PrismaService();
  }
  return prisma;
};

export const cleanup = async () => {
  const prisma = getPrisma();
  const modelNames = Object.keys(prisma).filter(
    (key) => key[0] !== '_' && key[0] !== '$',
  );

  for (const modelName of modelNames) {
    await prisma[modelName].deleteMany({});
  }
};
