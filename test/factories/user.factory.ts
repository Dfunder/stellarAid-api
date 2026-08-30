import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { getPrisma } from '../test-utils';

export const createUser = async (
  data: Partial<Prisma.UserCreateInput> = {},
): Promise<User> => {
  const prisma = getPrisma();
  const userData: Prisma.UserCreateInput = {
    email: `user-${Date.now()}@example.com`,
    passwordHash: await bcrypt.hash('Password123!', 10),
    name: 'Test User',
    role: 'ARTIST',
    ...data,
  };
  return prisma.user.create({ data: userData });
};
