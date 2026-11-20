import {
  Inject,
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MEDIA_STORAGE_PROVIDER, MEDIA_VALIDATION_HOOKS } from './media.tokens';
import type {
  MediaStorageProvider,
  MediaUpload,
  MediaValidationHook,
  StoredMedia,
} from './media.types';

@Injectable()
export class MediaService {
  constructor(
    @Optional()
    @Inject(MEDIA_STORAGE_PROVIDER)
    private readonly storageProvider?: MediaStorageProvider,
    @Optional()
    @Inject(MEDIA_VALIDATION_HOOKS)
    private readonly validationHooks?: readonly MediaValidationHook[],
  ) {}

  async upload(upload: MediaUpload): Promise<StoredMedia> {
    if (!this.storageProvider || !this.validationHooks?.length) {
      throw new ServiceUnavailableException(
        'Media storage and validation providers are not configured.',
      );
    }

    for (const hook of this.validationHooks) {
      await hook.validate(upload);
    }

    return this.storageProvider.store(upload);
  }
}
