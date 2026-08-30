# Integration Testing Guide for stellarAid-api

## Table of Contents

1. [Overview](#overview)
2. [Test Setup & Configuration](#test-setup--configuration)
3. [Running Integration Tests](#running-integration-tests)
4. [Test Structure](#test-structure)
5. [Test Fixtures & Helpers](#test-fixtures--helpers)
6. [Writing Integration Tests](#writing-integration-tests)
7. [Database Testing](#database-testing)
8. [Authentication Testing](#authentication-testing)
9. [API Endpoint Testing](#api-endpoint-testing)
10. [Stellar Integration Testing](#stellar-integration-testing)
11. [Best Practices](#best-practices)
12. [Troubleshooting](#troubleshooting)
13. [CI/CD Integration](#cicd-integration)

## Overview

This document describes the integration testing framework for the stellarAid-api (Lumora platform). Integration tests verify that different components of the application work together correctly, including:

- **Database Interactions**: CRUD operations, relationships, constraints
- **Authentication Flows**: Registration, login, JWT validation, role-based access
- **API Endpoints**: Request/response validation, error handling, state transitions
- **Stellar Integration**: Escrow payments, transaction signing, payment release
- **Business Logic**: Commission lifecycle, payment flows, artist verification

### Test Files

```
test/
├── fixtures/                          # Test data generators
│   ├── user.fixture.ts               # User test data
│   ├── commission.fixture.ts          # Commission test data
│
├── helpers/                           # Test utilities
│   ├── test-app.helper.ts            # NestJS app setup
│   ├── database.helper.ts            # Database operations
│   ├── auth.helper.ts                # JWT and Stellar utils
│
├── database.integration.spec.ts       # Database tests
├── auth.integration.e2e-spec.ts       # Authentication tests
├── api-endpoints.integration.e2e-spec.ts # API endpoint tests
├── stellar.integration.e2e-spec.ts    # Stellar payment tests
├── jest-e2e.json                     # Jest configuration for e2e tests
└── [existing-tests]
```

## Test Setup & Configuration

### Prerequisites

1. Node.js 18+ and npm/yarn
2. PostgreSQL 13+ (local or Docker)
3. Redis (for caching tests)
4. Environment variables configured

### Environment Configuration

Create a `.env.test` file for test environment:

```bash
# Database
DATABASE_URL=postgresql://testuser:testpassword@localhost:5432/lumora_test

# JWT
JWT_SECRET=test-secret-key-for-testing-only

# Stellar (Testnet)
STELLAR_NETWORK=TESTNET
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org

# Redis
REDIS_URL=redis://localhost:6379

# Server
PORT=3001
```

### Database Setup for Tests

```bash
# Create test database
createdb lumora_test

# Run migrations
npx prisma migrate deploy --skip-generate --skip-seed

# Or use the provided setup script
npm run test:db:setup
```

## Running Integration Tests

### Run All Integration Tests

```bash
npm run test:e2e
```

### Run Specific Test Suite

```bash
# Database integration tests
npm run test:e2e -- database.integration.spec.ts

# Authentication integration tests
npm run test:e2e -- auth.integration.e2e-spec.ts

# API endpoints tests
npm run test:e2e -- api-endpoints.integration.e2e-spec.ts

# Stellar integration tests
npm run test:e2e -- stellar.integration.e2e-spec.ts
```

### Run Tests with Coverage

```bash
npm run test:e2e -- --coverage
```

### Run Tests in Watch Mode

```bash
npm run test:e2e -- --watch
```

### Run Single Test

```bash
npm run test:e2e -- -t "should create a user with valid data"
```

### Run Tests with Debug Output

```bash
DEBUG=lumora:* npm run test:e2e
```

## Test Structure

Each integration test file follows a consistent structure:

```typescript
describe('Feature Name Integration Tests', () => {
  // Setup
  beforeAll(async () => {
    // Initialize app and database
  });

  afterEach(async () => {
    // Clean up after each test
  });

  afterAll(async () => {
    // Cleanup resources
  });

  describe('Sub-feature', () => {
    it('should perform specific action', async () => {
      // Arrange
      const testData = await setupTestData();

      // Act
      const result = await performAction(testData);

      // Assert
      expect(result).toBeDefined();
      expect(result.property).toBe(expectedValue);
    });
  });
});
```

### Naming Conventions

- Test files: `*.integration.spec.ts` or `*.e2e-spec.ts`
- Test suites: `describe('Feature Name Integration Tests', ...)`
- Test cases: `it('should [action] when [condition]', ...)`
- Fixtures: `*Fixture` class with static methods

## Test Fixtures & Helpers

### User Fixtures

```typescript
import { UserFixture } from './fixtures/user.fixture';

// Create a single test user
const user = await UserFixture.createTestUser({
  email: 'custom@example.com',
  role: Role.ARTIST,
});

// Create specific user types
const artist = await UserFixture.createArtistUser();
const client = await UserFixture.createClientUser();
const admin = await UserFixture.createAdminUser();

// Create multiple users
const users = await UserFixture.createMultipleTestUsers(5);
```

### Commission Fixtures

```typescript
import { CommissionFixture } from './fixtures/commission.fixture';

// Create a commission
const commission = CommissionFixture.createTestCommission({
  artistId: 'artist-id',
  clientId: 'client-id',
  priceUsdc: '500.00',
});

// Create commissions in specific states
const requested = CommissionFixture.createRequestedCommission();
const inProgress = CommissionFixture.createInProgressCommission();
const completed = CommissionFixture.createCompletedCommission();

// Create multiple commissions
const commissions = CommissionFixture.createMultipleCommissions(10);
```

### Database Helper

```typescript
import { DatabaseHelper } from './helpers/database.helper';

// User operations
const user = await DatabaseHelper.createUser(userData);
const foundUser = await DatabaseHelper.getUserByEmail('email@example.com');
const users = await DatabaseHelper.createUsers(3);
await DatabaseHelper.verifyUser(userId);

// Commission operations
const commission = await DatabaseHelper.createCommission(commissionData);
const retrieved = await DatabaseHelper.getCommissionById(commissionId);
await DatabaseHelper.updateCommissionStatus(commissionId, 'ACCEPTED');

// Payment operations
const payment = await DatabaseHelper.createPayment(paymentData);
const paymentFound = await DatabaseHelper.getPaymentById(paymentId);

// Cleanup
await DatabaseHelper.cleanDatabase();
await DatabaseHelper.disconnect();
```

### Authentication Helper

```typescript
import { AuthHelper } from './helpers/auth.helper';

// Generate JWT tokens
const token = AuthHelper.generateJWT(userId, email, 'ARTIST');
const adminToken = AuthHelper.createAdminTestToken();
const expiredToken = AuthHelper.createExpiredTestToken();

// JWT operations
const decoded = AuthHelper.verifyJWT(token);
const payload = AuthHelper.decodeJWT(token);

// Stellar keypairs
const keypair = AuthHelper.createStellarKeypair();
const isValid = AuthHelper.isValidStellarAddress(publicKey);

// Auth headers
const headers = AuthHelper.getAuthHeaders(token);
```

## Writing Integration Tests

### Template for API Endpoint Tests

```typescript
it('should create a resource with valid data', async () => {
  // Arrange - Setup test data
  const user = await DatabaseHelper.createUser(userData);
  const token = AuthHelper.generateJWT(user.id, user.email);

  // Act - Make API request
  const response = await request(app.getHttpServer())
    .post('/v1/endpoint')
    .set('Authorization', `Bearer ${token}`)
    .send({
      field1: 'value1',
      field2: 'value2',
    })
    .expect(201);

  // Assert - Verify response and side effects
  expect(response.body).toBeDefined();
  expect(response.body.id).toBeDefined();
  expect(response.body.field1).toBe('value1');

  // Verify database was updated
  const createdResource = await DatabaseHelper.getResourceById(response.body.id);
  expect(createdResource).toBeDefined();
  expect(createdResource.field1).toBe('value1');
});
```

### Template for Database Tests

```typescript
it('should maintain referential integrity', async () => {
  // Arrange
  const artist = await DatabaseHelper.createUser(artistData);
  const client = await DatabaseHelper.createUser(clientData);

  // Act
  const commission = await DatabaseHelper.createCommission({
    artistId: artist.id,
    clientId: client.id,
    ...commissionData,
  });

  // Assert
  const retrieved = await DatabaseHelper.getCommissionById(commission.id);
  expect(retrieved.artistId).toBe(artist.id);
  expect(retrieved.clientId).toBe(client.id);

  // Verify deletion cascades
  await DatabaseHelper.deleteUser(artist.id);
  const deletedCommission = await DatabaseHelper.getCommissionById(commission.id);
  expect(deletedCommission).toBeNull(); // If cascade delete is configured
});
```

## Database Testing

### Testing User Operations

```typescript
// Create and retrieve
const user = await DatabaseHelper.createUser({
  email: 'test@example.com',
  name: 'Test User',
  passwordHash: await bcrypt.hash('password', 10),
  role: Role.ARTIST,
});

const found = await DatabaseHelper.getUserByEmail('test@example.com');
expect(found.id).toBe(user.id);

// Update
const updated = await prisma.user.update({
  where: { id: user.id },
  data: { name: 'Updated Name' },
});

// Delete
await DatabaseHelper.deleteUser(user.id);
const deleted = await DatabaseHelper.getUserById(user.id);
expect(deleted).toBeNull();
```

### Testing Artist Profiles

```typescript
const artist = await DatabaseHelper.createArtistProfile({
  userId: artistUser.id,
  bio: 'Professional artist',
  skills: ['Illustration', 'Design'],
  location: 'San Francisco',
});

// Update ratings
const prisma = DatabaseHelper.getPrismaClient();
await prisma.artist.update({
  where: { userId: artistUser.id },
  data: {
    averageRating: 4.5,
    totalReviews: 10,
  },
});
```

### Testing Commission Lifecycle

```typescript
// Create in REQUESTED state
const commission = await DatabaseHelper.createCommission({
  status: 'REQUESTED',
  artistId: artistId,
  clientId: clientId,
});

// Transition through states
const accepted = await DatabaseHelper.updateCommissionStatus(
  commission.id,
  'ACCEPTED',
);
expect(accepted.status).toBe('ACCEPTED');

const inProgress = await DatabaseHelper.updateCommissionStatus(
  commission.id,
  'IN_PROGRESS',
);
expect(inProgress.status).toBe('IN_PROGRESS');

const completed = await DatabaseHelper.updateCommissionStatus(
  commission.id,
  'COMPLETED',
);
expect(completed.status).toBe('COMPLETED');
```

## Authentication Testing

### Testing Registration Flow

```typescript
it('should register a user and hash password', async () => {
  const response = await request(app.getHttpServer())
    .post('/v1/auth/register')
    .send({
      email: 'newuser@example.com',
      name: 'New User',
      password: 'SecurePass123!',
    })
    .expect(201);

  // Verify user was created
  const user = await DatabaseHelper.getUserByEmail('newuser@example.com');
  expect(user).toBeDefined();

  // Verify password was hashed
  const passwordMatches = await bcrypt.compare(
    'SecurePass123!',
    user.passwordHash,
  );
  expect(passwordMatches).toBe(true);
});
```

### Testing Login Flow

```typescript
it('should return JWT token on successful login', async () => {
  // Create verified user
  const userData = await UserFixture.createTestUser();
  const user = await DatabaseHelper.createUser(userData);

  const response = await request(app.getHttpServer())
    .post('/v1/auth/login')
    .send({
      email: userData.email,
      password: 'TestPassword123!',
    })
    .expect(200);

  // Verify token is valid
  const decoded = AuthHelper.verifyJWT(response.body.accessToken);
  expect(decoded.sub).toBe(user.id);
  expect(decoded.email).toBe(userData.email);
});
```

### Testing Token Validation

```typescript
it('should reject requests with expired tokens', async () => {
  const expiredToken = AuthHelper.createExpiredTestToken();

  await request(app.getHttpServer())
    .get('/v1/users/me')
    .set('Authorization', `Bearer ${expiredToken}`)
    .expect(401);
});

it('should reject requests with invalid signatures', async () => {
  const token = AuthHelper.generateJWT('user-id', 'user@example.com');
  const tamperedToken = token.slice(0, -5) + 'XXXXX'; // Tamper signature

  await request(app.getHttpServer())
    .get('/v1/users/me')
    .set('Authorization', `Bearer ${tamperedToken}`)
    .expect(401);
});
```

## API Endpoint Testing

### Testing CRUD Operations

```typescript
// CREATE
const createResponse = await request(app.getHttpServer())
  .post('/v1/commissions')
  .set('Authorization', `Bearer ${token}`)
  .send(commissionData)
  .expect(201);

// READ
const readResponse = await request(app.getHttpServer())
  .get(`/v1/commissions/${createResponse.body.id}`)
  .set('Authorization', `Bearer ${token}`)
  .expect(200);

// UPDATE
const updateResponse = await request(app.getHttpServer())
  .patch(`/v1/commissions/${createResponse.body.id}`)
  .set('Authorization', `Bearer ${token}`)
  .send({ status: 'ACCEPTED' })
  .expect(200);

// LIST with pagination
const listResponse = await request(app.getHttpServer())
  .get('/v1/commissions?page=1&limit=10')
  .set('Authorization', `Bearer ${token}`)
  .expect(200);
```

### Testing Error Handling

```typescript
// Invalid input
await request(app.getHttpServer())
  .post('/v1/commissions')
  .set('Authorization', `Bearer ${token}`)
  .send({ title: 'Missing required fields' })
  .expect(400);

// Unauthorized access
await request(app.getHttpServer())
  .get('/v1/admin/users')
  .set('Authorization', `Bearer ${artistToken}`)
  .expect(403);

// Not found
await request(app.getHttpServer())
  .get('/v1/commissions/non-existent-id')
  .set('Authorization', `Bearer ${token}`)
  .expect(404);
```

### Testing State Transitions

```typescript
// Test valid transitions
const commission = await createCommission();
expect(commission.status).toBe('REQUESTED');

await updateCommissionStatus(commission.id, 'ACCEPTED');
const updated = await getCommission(commission.id);
expect(updated.status).toBe('ACCEPTED');

// Test invalid transitions
await expect(
  updateCommissionStatus(commission.id, 'COMPLETED'),
).rejects.toThrow('invalid transition');
```

## Stellar Integration Testing

### Testing Escrow Initiation

```typescript
it('should create escrow payment and return unsigned XDR', async () => {
  const response = await request(app.getHttpServer())
    .post(`/v1/payments/commissions/${commission.id}/escrow`)
    .set('Authorization', `Bearer ${clientToken}`)
    .send({
      amount: '500.00',
      assetCode: 'USDC',
    })
    .expect(201);

  expect(response.body.xdr).toBeDefined();
  expect(response.body.paymentId).toBeDefined();
  expect(response.body.status).toBe('PENDING');
});
```

### Testing Payment Confirmation

```typescript
it('should confirm payment with signed XDR', async () => {
  // Generate unsigned XDR
  const escrowResponse = await initiateEscrow(commission.id);

  // Sign XDR (mocked in tests)
  const signedXdr = mockSignXdr(escrowResponse.xdr);

  // Confirm payment
  const response = await request(app.getHttpServer())
    .post('/v1/payments/confirm')
    .set('Authorization', `Bearer ${clientToken}`)
    .send({
      paymentId: escrowResponse.paymentId,
      signedXdr,
    })
    .expect(200);

  expect(response.body.status).toBe('CONFIRMED');
  expect(response.body.transactionHash).toBeDefined();
});
```

### Testing Payment Release

```typescript
it('should release payment to artist with fee deduction', async () => {
  // Setup completed commission with confirmed payment
  await confirmPayment(commission.id);

  const response = await request(app.getHttpServer())
    .post(`/v1/payments/commissions/${commission.id}/release`)
    .set('Authorization', `Bearer ${clientToken}`)
    .send({})
    .expect(200);

  const platformFee = 0.1; // 10%
  const expectedArtistAmount = 500 * (1 - platformFee);

  expect(parseFloat(response.body.artistAmount)).toBe(expectedArtistAmount);
  expect(response.body.status).toBe('RELEASED');
});
```

## Best Practices

### 1. Test Isolation

- Use `beforeEach` to reset database state
- Clean up resources in `afterEach`
- Each test should be independent and runnable in any order

```typescript
afterEach(async () => {
  await DatabaseHelper.cleanDatabase();
});
```

### 2. Clear Test Naming

- Use descriptive names that explain what is being tested
- Follow the "should... when..." pattern

```typescript
it('should reject login when password is incorrect', async () => {
  // test code
});

it('should allow payment release only when commission is completed', async () => {
  // test code
});
```

### 3. Use Fixtures for Test Data

- Leverage `UserFixture`, `CommissionFixture` for consistency
- Create fixture methods for common data patterns
- Avoid duplicating test data setup

```typescript
const artist = await UserFixture.createArtistUser();
const commission = CommissionFixture.createInProgressCommission();
```

### 4. Test Both Happy Path and Error Cases

```typescript
describe('Commission Creation', () => {
  it('should create commission with valid data', async () => {
    // Happy path
  });

  it('should reject with missing required fields', async () => {
    // Error case
  });

  it('should reject with invalid price', async () => {
    // Validation error case
  });
});
```

### 5. Verify Side Effects

```typescript
// Not just verifying API response, but also database state
const response = await createCommission(data);

// Verify database was updated
const stored = await DatabaseHelper.getCommissionById(response.body.id);
expect(stored.title).toBe(data.title);
```

### 6. Test Business Logic

```typescript
// Test commission state machine
it('should enforce valid state transitions', async () => {
  const commission = await createCommission();
  expect(commission.status).toBe('REQUESTED');

  await updateStatus('ACCEPTED');
  await updateStatus('IN_PROGRESS');
  await updateStatus('DELIVERED');

  // Invalid transition should fail
  await expect(updateStatus('REQUESTED')).rejects.toThrow();
});
```

### 7. Mock External Services

```typescript
// Mock Stellar network calls
jest.mock('@stellar/stellar-sdk', () => ({
  ...jest.requireActual('@stellar/stellar-sdk'),
  Server: jest.fn(() => ({
    submitTransaction: jest.fn().mockResolvedValue({
      id: 'mock-tx-hash',
    }),
  })),
}));
```

### 8. Use Appropriate HTTP Status Codes in Tests

```typescript
// Test expects specific status codes
.expect(200);  // Success
.expect(201);  // Created
.expect(400);  // Bad request
.expect(401);  // Unauthorized
.expect(403);  // Forbidden
.expect(404);  // Not found
.expect(429);  // Rate limited
```

## Troubleshooting

### Test Database Connection Issues

**Problem**: `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Solution**:
```bash
# Start PostgreSQL service
brew services start postgresql  # macOS
sudo systemctl start postgresql # Linux

# Verify connection
psql -U postgres -d lumora_test -c "SELECT 1"
```

### Port Already in Use

**Problem**: `Error: listen EADDRINUSE: address already in use :::3001`

**Solution**:
```bash
# Find and kill process using port
lsof -i :3001
kill -9 <PID>

# Or use different port in test env
PORT=3002 npm run test:e2e
```

### Database Migration Issues

**Problem**: `Error: Unable to acquire a connection`

**Solution**:
```bash
# Reset database
npm run test:db:reset

# Or manually
dropdb lumora_test
createdb lumora_test
npx prisma migrate deploy
```

### JWT Token Errors

**Problem**: `Error: Invalid token: jwt malformed`

**Solution**:
```typescript
// Verify JWT_SECRET is set in test environment
console.log(process.env.JWT_SECRET); // Should be set

// Regenerate tokens
const token = AuthHelper.generateJWT(userId, email);
```

### Timeout Issues

**Problem**: `Jest did not exit one second after the test run has completed`

**Solution**:
```typescript
// Ensure database disconnects
afterAll(async () => {
  await DatabaseHelper.disconnect();
  await app.close();
});

// Set timeout if needed
jest.setTimeout(30000); // 30 seconds
```

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: lumora_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Setup database
        run: |
          npm run test:db:setup
        env:
          DATABASE_URL: postgresql://postgres:testpass@localhost:5432/lumora_test

      - name: Run integration tests
        run: npm run test:e2e
        env:
          DATABASE_URL: postgresql://postgres:testpass@localhost:5432/lumora_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-secret

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

### Running Tests Locally

```bash
# Run all tests
npm run test:e2e

# Run with coverage
npm run test:e2e -- --coverage

# Run specific suite
npm run test:e2e -- auth.integration.e2e-spec.ts

# Watch mode for development
npm run test:e2e -- --watch
```

## Performance Considerations

### Database Test Performance

- Use transactions to rollback changes faster
- Create fixtures that reuse common test data
- Batch operations when possible

```typescript
beforeEach(async () => {
  await DatabaseHelper.cleanDatabase();
  // Reusable test data
  testUser = await UserFixture.createTestUser();
});
```

### Network Test Performance

- Mock external API calls
- Use test fixtures instead of real data
- Cache repeated requests

## Coverage Goals

Aim for the following coverage targets:

- **Lines**: 80%+
- **Branches**: 75%+
- **Functions**: 80%+
- **Critical paths**: 100% (authentication, payments, database)

## Additional Resources

- [NestJS Testing Documentation](https://docs.nestjs.com/fundamentals/testing)
- [Jest Documentation](https://jestjs.io/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Stellar SDK Documentation](https://developers.stellar.org/docs/build/apps/node)
- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing/integration-testing)
