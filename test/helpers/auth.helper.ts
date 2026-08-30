import * as jwt from 'jsonwebtoken';
import { Keypair } from '@stellar/stellar-sdk';

/**
 * Authentication and JWT utilities for integration tests
 */
export class AuthHelper {
  /**
   * Generate a JWT token for testing
   */
  static generateJWT(
    userId: string,
    email: string,
    role: string = 'ARTIST',
    expiresIn: string = '24h',
  ): string {
    const secret = process.env.JWT_SECRET || 'test-secret-key';

    return jwt.sign(
      {
        sub: userId,
        email,
        role,
      },
      secret,
      { expiresIn },
    );
  }

  /**
   * Verify a JWT token
   */
  static verifyJWT(token: string): any {
    const secret = process.env.JWT_SECRET || 'test-secret-key';
    try {
      return jwt.verify(token, secret);
    } catch (error) {
      throw new Error(`Invalid token: ${error.message}`);
    }
  }

  /**
   * Decode a JWT token without verification
   */
  static decodeJWT(token: string): any {
    return jwt.decode(token);
  }

  /**
   * Create a Stellar keypair for testing
   */
  static createStellarKeypair(): {
    publicKey: string;
    secretKey: string;
    keypair: Keypair;
  } {
    const keypair = Keypair.random();
    return {
      publicKey: keypair.publicKey(),
      secretKey: keypair.secret(),
      keypair,
    };
  }

  /**
   * Create a mock Stellar public key
   */
  static createMockStellarPublicKey(): string {
    return Keypair.random().publicKey();
  }

  /**
   * Create a mock Stellar secret key
   */
  static createMockStellarSecretKey(): string {
    return Keypair.random().secret();
  }

  /**
   * Get auth headers for API requests
   */
  static getAuthHeaders(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Create a default test token
   */
  static createDefaultTestToken(userId: string = 'test-user-id'): string {
    return this.generateJWT(userId, 'test@example.com', 'ARTIST');
  }

  /**
   * Create an admin test token
   */
  static createAdminTestToken(userId: string = 'admin-user-id'): string {
    return this.generateJWT(userId, 'admin@example.com', 'ADMIN');
  }

  /**
   * Create a client test token
   */
  static createClientTestToken(userId: string = 'client-user-id'): string {
    return this.generateJWT(userId, 'client@example.com', 'CLIENT');
  }

  /**
   * Create an expired test token
   */
  static createExpiredTestToken(userId: string = 'test-user-id'): string {
    return this.generateJWT(userId, 'test@example.com', 'ARTIST', '0s');
  }

  /**
   * Create a malformed token
   */
  static createMalformedToken(): string {
    return 'invalid.token.format';
  }

  /**
   * Validate Stellar address format
   */
  static isValidStellarAddress(address: string): boolean {
    try {
      const keypair = Keypair.fromPublicKey(address);
      return keypair.publicKey() === address;
    } catch {
      return false;
    }
  }
}
