import {
  INestApplication,
  Injectable,
  Module,
  VersioningType,
} from '@nestjs/common';
import { PassportModule, PassportStrategy } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { createValidationPipe } from '../../src/common/validation/validation.pipe';
import { PrismaService } from '../../src/prisma/prisma.service';
import { StellarService } from '../../src/payments/stellar.service';
import { AppModule } from '../../src/app.module';
import { cleanup } from '../test-utils';

/**
 * Real Passport `jwt` strategy bound to the same JWT_SECRET that
 * AuthService.login signs tokens with. Registering it lets the real
 * JwtAuthGuard / RolesGuard run unmodified in E2E tests.
 */
@Injectable()
export class TestJwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'test-secret-key',
    });
  }

  async validate(payload: Record<string, unknown>): Promise<unknown> {
    return payload;
  }
}

/**
 * Shares the same PassportModule instance used by AuthModule so the
 * AuthGuard('jwt') picks up the test strategy.
 */
@Module({
  imports: [PassportModule],
  providers: [TestJwtStrategy],
})
export class TestAuthStrategyModule {}

/**
 * Off-chain Stellar service stand-in. All on-chain calls are faked so that
 * E2E tests never touch Horizon / Soroban networks.
 */
export const stellarServiceMock = {
  buildEscrowCreationTx: jest
    .fn()
    .mockResolvedValue('AAAA-test-unsigned-escrow-xdr'),
  submitTransaction: jest
    .fn()
    .mockResolvedValue({ txHash: 'mock-tx-hash', successful: true }),
  releaseFundsOnChain: jest
    .fn()
    .mockResolvedValue({ txHash: 'release-tx-hash' }),
  refundFundsOnChain: jest.fn().mockResolvedValue({ txHash: 'refund-tx-hash' }),
  partialReleaseFundsOnChain: jest
    .fn()
    .mockResolvedValue({ txHash: 'partial-release-tx-hash' }),
  buildEscrowTransaction: jest.fn().mockResolvedValue('AAAA-test-escrow-xdr'),
  releaseFunds: jest.fn().mockResolvedValue({ txHash: 'release-tx-hash' }),
  getPlatformPublicKey: jest
    .fn()
    .mockReturnValue(
      'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    ),
  getEscrowContractId: jest.fn().mockReturnValue('test-escrow-contract'),
  getNetworkPassphrase: jest
    .fn()
    .mockReturnValue('Test SDF Network ; September 2015'),
  loadAccount: jest.fn(),
  verifyTransaction: jest.fn().mockResolvedValue({ status: 'SUCCESS' }),
};

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
  moduleFixture: TestingModule;
}

/**
 * Boots the full application (AppModule) with the same global configuration
 * used in production (URI versioning, validation pipe and exception filter),
 * but with throttling disabled, a real test JWT strategy registered for
 * authentication, and Stellar on-chain calls faked.
 */
export async function createTestApp(): Promise<TestApp> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule, TestAuthStrategyModule],
  })
    .overrideProvider(ThrottlerStorage)
    .useValue({
      increment: async () => ({
        totalHits: 0,
        timeToExpire: 0,
        isBlocked: false,
        timeToBlockExpire: 0,
      }),
    })
    .overrideProvider(StellarService)
    .useValue(stellarServiceMock)
    .compile();

  const app = moduleFixture.createNestApplication();
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();

  const prisma = app.get(PrismaService);
  await cleanup();

  return { app, prisma, moduleFixture };
}
