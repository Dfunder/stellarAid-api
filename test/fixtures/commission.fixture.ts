import { CommissionStatus, CommissionVisibility } from '@prisma/client';

/**
 * Commission test fixtures for integration tests
 */
export class CommissionFixture {
  /**
   * Create a test commission object
   */
  static createTestCommission(overrides?: Partial<any>) {
    const baseCommission = {
      id: 'commission-' + Math.random().toString(36).substr(2, 9),
      artistId: 'user-artist-' + Math.random().toString(36).substr(2, 9),
      clientId: 'user-client-' + Math.random().toString(36).substr(2, 9),
      title: 'Test Commission: Digital Illustration',
      description: 'A beautiful digital illustration for a gaming project',
      status: CommissionStatus.REQUESTED,
      visibility: CommissionVisibility.PRIVATE,
      priceUsdc: '500.00',
      priceBrl: '2500.00',
      estimatedDaysToComplete: 14,
      revisionCount: 3,
      attachmentUrls: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      deliveredAt: null,
      completedAt: null,
      cancelledAt: null,
      ...overrides,
    };

    return baseCommission;
  }

  /**
   * Create a requested commission (initial state)
   */
  static createRequestedCommission() {
    return this.createTestCommission({
      status: CommissionStatus.REQUESTED,
    });
  }

  /**
   * Create an accepted commission
   */
  static createAcceptedCommission() {
    return this.createTestCommission({
      status: CommissionStatus.ACCEPTED,
    });
  }

  /**
   * Create an in-progress commission
   */
  static createInProgressCommission() {
    return this.createTestCommission({
      status: CommissionStatus.IN_PROGRESS,
    });
  }

  /**
   * Create a delivered commission
   */
  static createDeliveredCommission() {
    return this.createTestCommission({
      status: CommissionStatus.DELIVERED,
      deliveredAt: new Date(),
    });
  }

  /**
   * Create a completed commission
   */
  static createCompletedCommission() {
    return this.createTestCommission({
      status: CommissionStatus.COMPLETED,
      completedAt: new Date(),
      deliveredAt: new Date(Date.now() - 86400000), // 1 day ago
    });
  }

  /**
   * Create a cancelled commission
   */
  static createCancelledCommission() {
    return this.createTestCommission({
      status: CommissionStatus.CANCELLED,
      cancelledAt: new Date(),
    });
  }

  /**
   * Create a public commission
   */
  static createPublicCommission() {
    return this.createTestCommission({
      visibility: CommissionVisibility.PUBLIC,
    });
  }

  /**
   * Create multiple commissions
   */
  static createMultipleCommissions(count: number, overrides?: Partial<any>) {
    const commissions = [];
    for (let i = 0; i < count; i++) {
      commissions.push(
        this.createTestCommission({
          id: `commission-${i}-${Math.random().toString(36).substr(2, 9)}`,
          title: `Test Commission ${i + 1}`,
          priceUsdc: `${100 * (i + 1)}.00`,
          ...overrides,
        }),
      );
    }
    return commissions;
  }
}
