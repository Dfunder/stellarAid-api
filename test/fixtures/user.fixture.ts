import { Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * User test fixtures for integration tests
 */
export class UserFixture {
  /**
   * Create a test user object with hashed password
   */
  static async createTestUser(overrides?: Partial<any>) {
    const baseUser = {
      id: 'user-' + Math.random().toString(36).substr(2, 9),
      email: `test-${Date.now()}@example.com`,
      name: 'Test User',
      passwordHash: await bcrypt.hash('TestPassword123!', 10),
      role: Role.ARTIST,
      status: UserStatus.VERIFIED,
      walletAddress: 'GBLJGBXD3RVLK5HDQVLTHK44LGLZQPFOXOXSQJVVNZUWWX2GMXVVVBX5',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };

    return baseUser;
  }

  /**
   * Create multiple test users
   */
  static async createMultipleTestUsers(count: number) {
    const users = [];
    for (let i = 0; i < count; i++) {
      users.push(
        await this.createTestUser({
          email: `test-user-${i}-${Date.now()}@example.com`,
          id: `user-${i}-${Math.random().toString(36).substr(2, 9)}`,
        }),
      );
    }
    return users;
  }

  /**
   * Create a client user
   */
  static async createClientUser() {
    return this.createTestUser({
      role: Role.CLIENT,
      name: 'Test Client',
    });
  }

  /**
   * Create an artist user
   */
  static async createArtistUser() {
    return this.createTestUser({
      role: Role.ARTIST,
      name: 'Test Artist',
    });
  }

  /**
   * Create an admin user
   */
  static async createAdminUser() {
    return this.createTestUser({
      role: Role.ADMIN,
      name: 'Test Admin',
    });
  }

  /**
   * Create an unverified user
   */
  static async createUnverifiedUser() {
    return this.createTestUser({
      status: UserStatus.PENDING_VERIFICATION,
    });
  }
}
