export interface MediaUpload {
  readonly filename: string;
  readonly contentType: string;
  readonly size: number;
  readonly contents: Uint8Array;
}

export interface StoredMedia {
  readonly key: string;
  readonly url?: string;
}

export interface MediaStorageProvider {
  store(upload: MediaUpload): Promise<StoredMedia>;
}

export interface MediaValidationHook {
  validate(upload: MediaUpload): void | Promise<void>;
}
