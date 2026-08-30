import { Prisma, User } from '@prisma/client';
import { getPrisma } from '../test-utils';

export const createUser = async (
  data: Partial<Prisma.UserCreateInput> = {},
): Promise<User> => {
  const prisma = getPrisma();
  const userData: Prisma.UserCreateInput = {
    email: `user-${Date.now()}@example.com`,
    password: 'password',
    ...data,
  };
  return prisma.user.create({ data: userData });
};
