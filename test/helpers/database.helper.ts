import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * Database helper utilities for integration tests
 */
export class DatabaseHelper {
  private static prisma: PrismaClient;

  /**
   * Initialize Prisma client (call once in beforeAll)
   */
  static getPrismaClient(): PrismaClient {
    if (!this.prisma) {
      this.prisma = new PrismaClient();
    }
    return this.prisma;
  }

  /**
   * Clean up all data from test database
   * WARNING: Only use in test environments!
   */
  static async cleanDatabase(): Promise<void> {
    const prisma = this.getPrismaClient();

    const tables = [
      'notification',
      'message',
      'review',
      'audit_log',
      'commission',
      'artist',
      'user',
      'payment',
      'verified_phone',
      'device_token',
    ];

    for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
      } catch (error) {
        // Table might not exist or already empty
        console.warn(`Could not truncate table ${table}:`, error);
      }
    }
  }

  /**
   * Create a test user in the database
   */
  static async createUser(userData: any): Promise<any> {
    const prisma = this.getPrismaClient();
    return prisma.user.create({
      data: {
        ...userData,
        passwordHash: await bcrypt.hash(userData.password || 'TestPassword123!', 10),
      },
    });
  }

  /**
   * Create multiple test users
   */
  static async createUsers(count: number): Promise<any[]> {
    const users = [];
    for (let i = 0; i < count; i++) {
      const user = await this.createUser({
        email: `test-user-${i}-${Date.now()}@example.com`,
        name: `Test User ${i}`,
      });
      users.push(user);
    }
    return users;
  }

  /**
   * Get a user by email
   */
  static async getUserByEmail(email: string): Promise<any> {
    const prisma = this.getPrismaClient();
    return prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Get a user by ID
   */
  static async getUserById(id: string): Promise<any> {
    const prisma = this.getPrismaClient();
    return prisma.user.findUnique({
      where: { id },
      include: {
        artist: true,
        commissions: true,
      },
    });
  }

  /**
   * Delete a user by ID
   */
  static async deleteUser(id: string): Promise<void> {
    const prisma = this.getPrismaClient();
    await prisma.user.delete({
      where: { id },
    });
  }

  /**
   * Create a commission
   */
  static async createCommission(commissionData: any): Promise<any> {
    const prisma = this.getPrismaClient();
    return prisma.commission.create({
      data: commissionData,
    });
  }

  /**
   * Get a commission by ID
   */
  static async getCommissionById(id: string): Promise<any> {
    const prisma = this.getPrismaClient();
    return prisma.commission.findUnique({
      where: { id },
    });
  }

  /**
   * Update commission status
   */
  static async updateCommissionStatus(
    id: string,
    status: string,
  ): Promise<any> {
    const prisma = this.getPrismaClient();
    return prisma.commission.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Create a payment record
   */
  static async createPayment(paymentData: any): Promise<any> {
    const prisma = this.getPrismaClient();
    return prisma.payment.create({
      data: paymentData,
    });
  }

  /**
   * Get a payment by ID
   */
  static async getPaymentById(id: string): Promise<any> {
    const prisma = this.getPrismaClient();
    return prisma.payment.findUnique({
      where: { id },
    });
  }

  /**
   * Verify a user account
   */
  static async verifyUser(id: string): Promise<any> {
    const prisma = this.getPrismaClient();
    return prisma.user.update({
      where: { id },
      data: { status: 'VERIFIED' },
    });
  }

  /**
   * Create an artist profile
   */
  static async createArtistProfile(artistData: any): Promise<any> {
    const prisma = this.getPrismaClient();
    return prisma.artist.create({
      data: artistData,
    });
  }

  /**
   * Get artist profile by user ID
   */
  static async getArtistProfile(userId: string): Promise<any> {
    const prisma = this.getPrismaClient();
    return prisma.artist.findUnique({
      where: { userId },
    });
  }

  /**
   * Create a review
   */
  static async createReview(reviewData: any): Promise<any> {
    const prisma = this.getPrismaClient();
    return prisma.review.create({
      data: reviewData,
    });
  }

  /**
   * Get reviews for a user
   */
  static async getReviewsByUserId(userId: string): Promise<any[]> {
    const prisma = this.getPrismaClient();
    return prisma.review.findMany({
      where: { revieweeId: userId },
    });
  }

  /**
   * Disconnect Prisma client (call in afterAll)
   */
  static async disconnect(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
    }
  }
}
