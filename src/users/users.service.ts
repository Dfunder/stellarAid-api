import { Injectable } from '@nestjs/common';
import { UsersRepository } from './users.repository';

/**
 * Business-logic layer for user operations.
 *
 * Delegates all persistence to {@link UsersRepository} so this service stays
 * focused on application logic and remains easy to unit-test with a mocked
 * repository.
 */
@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  /**
   * Retrieve a user by their unique id.
   * @param id - The user's unique identifier.
   * @returns The matching user, or `null` if none exists.
   */
  async findById(id: string) {
    return this.usersRepository.findById(id);
  }

  /**
   * Retrieve a user by their email address.
   * @param email - The user's email address.
   * @returns The matching user, or `null` if none exists.
   */
  async findByEmail(email: string) {
    return this.usersRepository.findByEmail(email);
  }
}
