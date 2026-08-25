import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Data-access layer for the User entity.
 *
 * Encapsulates all Prisma queries for users so that services depend on this
 * repository rather than on Prisma directly. This keeps persistence concerns in
 * one place and makes the service layer easier to test in isolation.
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find a single user by their unique id.
   * @param id - The user's unique identifier.
   * @returns The matching user, or `null` if none exists.
   */
  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /**
   * Find a single user by their unique email address.
   * @param email - The user's email address.
   * @returns The matching user, or `null` if none exists.
   */
  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }
}
