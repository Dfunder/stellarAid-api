import { DatabaseHelper } from '../helpers/database.helper';
import { UserFixture } from '../fixtures/user.fixture';
import { CommissionFixture } from '../fixtures/commission.fixture';
import { Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

describe('Database Integration Tests', () => {
  beforeAll(async () => {
    // Setup database connection
  });

  afterEach(async () => {
    // Clean up after each test
    await DatabaseHelper.cleanDatabase();
  });

  afterAll(async () => {
    // Close database connection
    await DatabaseHelper.disconnect();
  });

  describe('User CRUD Operations', () => {
    it('should create a user with valid data', async () => {
      const userData = await UserFixture.createTestUser({
        email: 'newuser@example.com',
        name: 'New User',
      });

      const createdUser = await DatabaseHelper.createUser(userData);

      expect(createdUser).toBeDefined();
      expect(createdUser.email).toBe('newuser@example.com');
      expect(createdUser.name).toBe('New User');
      expect(createdUser.role).toBe(Role.ARTIST);
      expect(createdUser.status).toBe(UserStatus.VERIFIED);
    });

    it('should retrieve a user by email', async () => {
      const userData = await UserFixture.createTestUser({
        email: 'findme@example.com',
      });
      const createdUser = await DatabaseHelper.createUser(userData);

      const foundUser = await DatabaseHelper.getUserByEmail('findme@example.com');

      expect(foundUser).toBeDefined();
      expect(foundUser.id).toBe(createdUser.id);
      expect(foundUser.email).toBe('findme@example.com');
    });

    it('should retrieve a user by ID', async () => {
      const userData = await UserFixture.createTestUser();
      const createdUser = await DatabaseHelper.createUser(userData);

      const foundUser = await DatabaseHelper.getUserById(createdUser.id);

      expect(foundUser).toBeDefined();
      expect(foundUser.id).toBe(createdUser.id);
      expect(foundUser.email).toBe(userData.email);
    });

    it('should update user information', async () => {
      const userData = await UserFixture.createTestUser();
      const createdUser = await DatabaseHelper.createUser(userData);

      const prisma = DatabaseHelper.getPrismaClient();
      const updatedUser = await prisma.user.update({
        where: { id: createdUser.id },
        data: { name: 'Updated Name', walletAddress: 'GBCCCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCD' },
      });

      expect(updatedUser.name).toBe('Updated Name');
      expect(updatedUser.walletAddress).toBe('GBCCCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCD');
    });

    it('should delete a user', async () => {
      const userData = await UserFixture.createTestUser();
      const createdUser = await DatabaseHelper.createUser(userData);

      await DatabaseHelper.deleteUser(createdUser.id);

      const foundUser = await DatabaseHelper.getUserById(createdUser.id);
      expect(foundUser).toBeNull();
    });

    it('should create multiple users', async () => {
      const users = await DatabaseHelper.createUsers(3);

      expect(users).toHaveLength(3);
      users.forEach((user) => {
        expect(user).toBeDefined();
        expect(user.email).toBeDefined();
        expect(user.id).toBeDefined();
      });
    });

    it('should enforce unique email constraint', async () => {
      const email = `unique-${Date.now()}@example.com`;
      const userData1 = await UserFixture.createTestUser({ email });
      await DatabaseHelper.createUser(userData1);

      const userData2 = await UserFixture.createTestUser({ email });

      await expect(DatabaseHelper.createUser(userData2)).rejects.toThrow();
    });

    it('should verify a user account', async () => {
      const userData = await UserFixture.createUnverifiedUser();
      const createdUser = await DatabaseHelper.createUser(userData);
      expect(createdUser.status).toBe(UserStatus.PENDING_VERIFICATION);

      const verifiedUser = await DatabaseHelper.verifyUser(createdUser.id);

      expect(verifiedUser.status).toBe(UserStatus.VERIFIED);
    });

    it('should store password hash securely', async () => {
      const userData = await UserFixture.createTestUser();
      const createdUser = await DatabaseHelper.createUser(userData);

      const foundUser = await DatabaseHelper.getUserById(createdUser.id);
      const plainPassword = 'TestPassword123!';

      const passwordMatches = await bcrypt.compare(plainPassword, foundUser.passwordHash);
      expect(passwordMatches).toBe(true);
    });
  });

  describe('Artist Profile Operations', () => {
    it('should create an artist profile linked to a user', async () => {
      const userData = await UserFixture.createArtistUser();
      const createdUser = await DatabaseHelper.createUser(userData);

      const artistData = {
        userId: createdUser.id,
        bio: 'Professional digital artist',
        tagline: 'Digital Art & Illustrations',
        skills: ['Illustration', 'Digital Painting', 'Character Design'],
        location: 'San Francisco, USA',
        isProfilePublic: true,
      };

      const artist = await DatabaseHelper.createArtistProfile(artistData);

      expect(artist).toBeDefined();
      expect(artist.userId).toBe(createdUser.id);
      expect(artist.bio).toBe('Professional digital artist');
      expect(artist.skills).toEqual(['Illustration', 'Digital Painting', 'Character Design']);
    });

    it('should retrieve artist profile by user ID', async () => {
      const userData = await UserFixture.createArtistUser();
      const createdUser = await DatabaseHelper.createUser(userData);

      const artistData = {
        userId: createdUser.id,
        bio: 'Test artist',
        skills: ['Design'],
      };
      await DatabaseHelper.createArtistProfile(artistData);

      const artist = await DatabaseHelper.getArtistProfile(createdUser.id);

      expect(artist).toBeDefined();
      expect(artist.userId).toBe(createdUser.id);
      expect(artist.bio).toBe('Test artist');
    });

    it('should enforce one-to-one relationship between user and artist', async () => {
      const userData = await UserFixture.createArtistUser();
      const createdUser = await DatabaseHelper.createUser(userData);

      const artistData1 = {
        userId: createdUser.id,
        bio: 'First profile',
      };
      await DatabaseHelper.createArtistProfile(artistData1);

      const artistData2 = {
        userId: createdUser.id,
        bio: 'Second profile',
      };

      await expect(DatabaseHelper.createArtistProfile(artistData2)).rejects.toThrow();
    });
  });

  describe('Commission CRUD Operations', () => {
    it('should create a commission', async () => {
      const artistData = await UserFixture.createArtistUser();
      const clientData = await UserFixture.createClientUser();
      const artist = await DatabaseHelper.createUser(artistData);
      const client = await DatabaseHelper.createUser(clientData);

      const commissionData = CommissionFixture.createTestCommission({
        artistId: artist.id,
        clientId: client.id,
      });

      const commission = await DatabaseHelper.createCommission(commissionData);

      expect(commission).toBeDefined();
      expect(commission.artistId).toBe(artist.id);
      expect(commission.clientId).toBe(client.id);
      expect(commission.status).toBe('REQUESTED');
    });

    it('should retrieve a commission by ID', async () => {
      const artistData = await UserFixture.createArtistUser();
      const clientData = await UserFixture.createClientUser();
      const artist = await DatabaseHelper.createUser(artistData);
      const client = await DatabaseHelper.createUser(clientData);

      const commissionData = CommissionFixture.createTestCommission({
        artistId: artist.id,
        clientId: client.id,
      });
      const created = await DatabaseHelper.createCommission(commissionData);

      const retrieved = await DatabaseHelper.getCommissionById(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(created.id);
    });

    it('should update commission status', async () => {
      const artistData = await UserFixture.createArtistUser();
      const clientData = await UserFixture.createClientUser();
      const artist = await DatabaseHelper.createUser(artistData);
      const client = await DatabaseHelper.createUser(clientData);

      const commissionData = CommissionFixture.createTestCommission({
        artistId: artist.id,
        clientId: client.id,
        status: 'REQUESTED',
      });
      const commission = await DatabaseHelper.createCommission(commissionData);

      const updated = await DatabaseHelper.updateCommissionStatus(commission.id, 'ACCEPTED');

      expect(updated.status).toBe('ACCEPTED');
    });

    it('should create multiple commissions for same artist', async () => {
      const artistData = await UserFixture.createArtistUser();
      const artist = await DatabaseHelper.createUser(artistData);

      const clients = await DatabaseHelper.createUsers(3);

      const prisma = DatabaseHelper.getPrismaClient();
      const commissions = [];
      for (const client of clients) {
        const commissionData = CommissionFixture.createTestCommission({
          artistId: artist.id,
          clientId: client.id,
        });
        const commission = await prisma.commission.create({ data: commissionData });
        commissions.push(commission);
      }

      expect(commissions).toHaveLength(3);
      commissions.forEach((commission) => {
        expect(commission.artistId).toBe(artist.id);
      });
    });

    it('should track commission state transitions', async () => {
      const artistData = await UserFixture.createArtistUser();
      const clientData = await UserFixture.createClientUser();
      const artist = await DatabaseHelper.createUser(artistData);
      const client = await DatabaseHelper.createUser(clientData);

      const commissionData = CommissionFixture.createTestCommission({
        artistId: artist.id,
        clientId: client.id,
      });
      const commission = await DatabaseHelper.createCommission(commissionData);

      // Simulate state transitions
      const states = ['ACCEPTED', 'IN_PROGRESS', 'DELIVERED', 'COMPLETED'];
      let current = commission;

      for (const state of states) {
        current = await DatabaseHelper.updateCommissionStatus(current.id, state);
        expect(current.status).toBe(state);
      }
    });
  });

  describe('Payment Operations', () => {
    it('should create a payment record', async () => {
      const userData = await UserFixture.createClientUser();
      const user = await DatabaseHelper.createUser(userData);

      const paymentData = {
        id: 'payment-' + Math.random().toString(36).substr(2, 9),
        commissionId: 'commission-id',
        payerId: user.id,
        amountUsdc: '500.00',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const payment = await DatabaseHelper.createPayment(paymentData);

      expect(payment).toBeDefined();
      expect(payment.payerId).toBe(user.id);
      expect(payment.amountUsdc).toBe('500.00');
      expect(payment.status).toBe('PENDING');
    });

    it('should retrieve a payment by ID', async () => {
      const userData = await UserFixture.createClientUser();
      const user = await DatabaseHelper.createUser(userData);

      const paymentData = {
        id: 'payment-' + Math.random().toString(36).substr(2, 9),
        commissionId: 'commission-id',
        payerId: user.id,
        amountUsdc: '250.00',
        status: 'CONFIRMED',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const created = await DatabaseHelper.createPayment(paymentData);
      const retrieved = await DatabaseHelper.getPaymentById(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.amountUsdc).toBe('250.00');
    });
  });

  describe('Review System', () => {
    it('should create a review', async () => {
      const reviewerData = await UserFixture.createClientUser();
      const revieweeData = await UserFixture.createArtistUser();
      const reviewer = await DatabaseHelper.createUser(reviewerData);
      const reviewee = await DatabaseHelper.createUser(revieweeData);

      const reviewData = {
        id: 'review-' + Math.random().toString(36).substr(2, 9),
        commissionId: 'commission-id',
        reviewerId: reviewer.id,
        revieweeId: reviewee.id,
        rating: 5,
        comment: 'Excellent work!',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const review = await DatabaseHelper.createReview(reviewData);

      expect(review).toBeDefined();
      expect(review.reviewerId).toBe(reviewer.id);
      expect(review.revieweeId).toBe(reviewee.id);
      expect(review.rating).toBe(5);
    });

    it('should retrieve reviews for a user', async () => {
      const revieweeData = await UserFixture.createArtistUser();
      const reviewee = await DatabaseHelper.createUser(revieweeData);

      const reviewers = await DatabaseHelper.createUsers(3);

      for (const reviewer of reviewers) {
        const reviewData = {
          id: 'review-' + Math.random().toString(36).substr(2, 9),
          commissionId: 'commission-id',
          reviewerId: reviewer.id,
          revieweeId: reviewee.id,
          rating: 4 + Math.random(), // Random rating between 4-5
          comment: 'Good work!',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await DatabaseHelper.createReview(reviewData);
      }

      const reviews = await DatabaseHelper.getReviewsByUserId(reviewee.id);

      expect(reviews).toHaveLength(3);
      reviews.forEach((review) => {
        expect(review.revieweeId).toBe(reviewee.id);
      });
    });
  });
});
