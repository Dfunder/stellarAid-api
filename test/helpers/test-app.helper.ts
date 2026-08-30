import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DatabaseHelper } from './database.helper';

/**
 * Test application setup and teardown helper
 */
export class TestAppHelper {
  private static app: INestApplication;
  private static moduleFixture: TestingModule;

  /**
   * Initialize the NestJS application for testing
   */
  static async initializeApp(): Promise<INestApplication> {
    if (this.app) {
      return this.app;
    }

    this.moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    this.app = this.moduleFixture.createNestApplication();
    await this.app.init();

    return this.app;
  }

  /**
   * Get the initialized app instance
   */
  static getApp(): INestApplication {
    if (!this.app) {
      throw new Error(
        'Application not initialized. Call initializeApp() first.',
      );
    }
    return this.app;
  }

  /**
   * Get the testing module
   */
  static getModuleFixture(): TestingModule {
    if (!this.moduleFixture) {
      throw new Error(
        'Module fixture not initialized. Call initializeApp() first.',
      );
    }
    return this.moduleFixture;
  }

  /**
   * Get any service from the app
   */
  static getService(serviceClass: any): any {
    return this.getModuleFixture().get(serviceClass);
  }

  /**
   * Clean database and reset app state
   */
  static async resetDatabase(): Promise<void> {
    await DatabaseHelper.cleanDatabase();
  }

  /**
   * Shutdown the application
   */
  static async shutdownApp(): Promise<void> {
    if (this.app) {
      await this.app.close();
      this.app = null;
    }
    if (this.moduleFixture) {
      await this.moduleFixture.close();
      this.moduleFixture = null;
    }
  }

  /**
   * Setup global test fixtures
   */
  static async setupGlobalFixtures(): Promise<void> {
    await this.initializeApp();
  }

  /**
   * Cleanup after all tests
   */
  static async cleanupAfterAll(): Promise<void> {
    await this.shutdownApp();
    await DatabaseHelper.disconnect();
  }
}
