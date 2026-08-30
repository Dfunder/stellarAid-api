# Quick Reference: Integration Testing Commands

## Setup

### One-Time Setup
```bash
# Run the setup script (handles database, migrations, and dependencies)
bash scripts/test-setup.sh

# Or manual setup:
createdb lumora_test
npx prisma migrate deploy
npm install
```

## Running Tests

### All Tests
```bash
npm run test:e2e
```

### Specific Test Suite
```bash
npm run test:e2e -- database.integration.spec.ts
npm run test:e2e -- auth.integration.e2e-spec.ts
npm run test:e2e -- api-endpoints.integration.e2e-spec.ts
npm run test:e2e -- stellar.integration.e2e-spec.ts
```

### With Coverage Report
```bash
npm run test:e2e -- --coverage
npm run test:cov  # Alternative shorthand
```

### Watch Mode (for development)
```bash
npm run test:e2e -- --watch
npm run test:watch  # Alternative shorthand
```

### Single Test
```bash
npm run test:e2e -- -t "should create a user with valid data"
```

### Verbose Output
```bash
npm run test:e2e -- --verbose
```

### Debug Mode
```bash
npm run test:debug
```

## Database Management

### Reset Test Database
```bash
dropdb lumora_test
createdb lumora_test
npx prisma migrate deploy
```

### View Database
```bash
psql -d lumora_test
```

## Troubleshooting

### Tests Fail with "Cannot find module"
```bash
npm install
npm run build
```

### PostgreSQL Connection Error
```bash
# Start PostgreSQL
brew services start postgresql    # macOS
sudo systemctl start postgresql   # Linux

# Verify connection
psql -U postgres -c "SELECT 1"
```

### Port Already in Use
```bash
# Kill process using port 3001
lsof -i :3001
kill -9 <PID>

# Or use different port
PORT=3002 npm run test:e2e
```

### Test Timeout
Increase Jest timeout:
```bash
npm run test:e2e -- --testTimeout=30000
```

## Coverage Targets

| Metric | Target | Current |
|--------|--------|---------|
| Lines | 80%+ | - |
| Branches | 75%+ | - |
| Functions | 80%+ | - |
| Critical Paths | 100% | - |

## Test Organization

### Database Tests (`database.integration.spec.ts`)
- ✓ User CRUD operations
- ✓ Artist profile operations
- ✓ Commission lifecycle
- ✓ Payment records
- ✓ Review system

### Authentication Tests (`auth.integration.e2e-spec.ts`)
- ✓ User registration
- ✓ User login
- ✓ JWT token validation
- ✓ Token expiration
- ✓ Role-based access control
- ✓ Public endpoints
- ✓ Account security

### API Endpoint Tests (`api-endpoints.integration.e2e-spec.ts`)
- ✓ Commission CRUD
- ✓ User profiles
- ✓ Artist profiles
- ✓ Marketplace
- ✓ Search and filtering
- ✓ Pagination
- ✓ Error handling
- ✓ Data validation

### Stellar Integration Tests (`stellar.integration.e2e-spec.ts`)
- ✓ Escrow payment initiation
- ✓ Payment confirmation
- ✓ Payment release
- ✓ Stellar address validation
- ✓ Asset handling
- ✓ Transaction error handling

## Key Files

| File | Purpose |
|------|---------|
| `test/fixtures/user.fixture.ts` | User test data generators |
| `test/fixtures/commission.fixture.ts` | Commission test data generators |
| `test/helpers/database.helper.ts` | Database utility methods |
| `test/helpers/auth.helper.ts` | JWT and Stellar utilities |
| `test/helpers/test-app.helper.ts` | NestJS app initialization |
| `test/jest-e2e.json` | Jest configuration for e2e tests |
| `INTEGRATION_TESTING.md` | Comprehensive testing guide |

## Writing a New Integration Test

### 1. Create Test File
```typescript
// test/new-feature.integration.e2e-spec.ts
describe('New Feature Integration Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await DatabaseHelper.cleanDatabase();
  });

  afterAll(async () => {
    await app.close();
    await DatabaseHelper.disconnect();
  });

  it('should test something', async () => {
    // Arrange
    const user = await UserFixture.createTestUser();
    const token = AuthHelper.generateJWT(user.id, user.email);

    // Act
    const response = await request(app.getHttpServer())
      .get('/v1/endpoint')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Assert
    expect(response.body).toBeDefined();
  });
});
```

### 2. Use Fixtures and Helpers
```typescript
// Create test data
const artist = await UserFixture.createArtistUser();
const client = await UserFixture.createClientUser();
const commission = CommissionFixture.createTestCommission();

// Database operations
const user = await DatabaseHelper.createUser(userData);
const found = await DatabaseHelper.getUserById(user.id);

// Authentication
const token = AuthHelper.generateJWT(user.id, user.email);
const headers = AuthHelper.getAuthHeaders(token);
```

### 3. Follow AAA Pattern
```typescript
it('should perform action', async () => {
  // Arrange: Set up test data
  const user = await setupUser();
  const token = AuthHelper.generateJWT(user.id, user.email);

  // Act: Perform the action
  const response = await request(app.getHttpServer())
    .post('/v1/endpoint')
    .set('Authorization', `Bearer ${token}`)
    .send(testData)
    .expect(201);

  // Assert: Verify results
  expect(response.body.id).toBeDefined();
  const stored = await DatabaseHelper.getById(response.body.id);
  expect(stored).toBeDefined();
});
```

## Continuous Integration

### GitHub Actions
Tests run automatically on:
- Push to main/develop branches
- Pull requests
- Scheduled daily

Configure in `.github/workflows/integration-tests.yml`

## Performance Metrics

| Test Suite | Avg Time |
|------------|----------|
| Database | ~5-10s |
| Authentication | ~3-5s |
| API Endpoints | ~10-15s |
| Stellar | ~5-8s |
| **Total** | **~25-40s** |

## Support

For detailed information, see [INTEGRATION_TESTING.md](./INTEGRATION_TESTING.md)

Common questions:
1. How do I write integration tests? → See "Writing Integration Tests" section
2. How do I mock Stellar? → See "Stellar Integration Testing" section
3. Database test structure? → See "Database Testing" section
4. Getting an error? → Check "Troubleshooting" section
