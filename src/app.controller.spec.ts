import { Test, TestingModule } from '@nestjs/testing';
import { AppController, AppService } from './index';

describe('AppController', () => {
  let appController: AppController;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = moduleRef.get<AppController>(AppController);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
