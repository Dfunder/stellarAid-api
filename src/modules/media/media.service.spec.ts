import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { MediaService } from './media.service';

describe('MediaService', () => {
  let mediaService: MediaService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [MediaService],
    }).compile();

    mediaService = moduleRef.get(MediaService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('fails closed until storage and validation providers are configured', async () => {
    await expect(
      mediaService.upload({
        filename: 'proof.png',
        contentType: 'image/png',
        size: 1,
        contents: new Uint8Array([0]),
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
