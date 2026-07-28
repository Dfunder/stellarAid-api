// Fix for #450: validate an uploaded avatar (image only, max 5MB)
// before it is handed off to S3-compatible storage.
export interface UploadedFile {
  mimetype: string;
  size: number;
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export function validateAvatarUpload(file: UploadedFile): void {
  if (!file.mimetype.startsWith('image/')) {
    throw new Error('Avatar must be an image file');
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error('Avatar must be 5MB or smaller');
  }
}

export function buildAvatarKey(artistId: string, originalName: string): string {
  const ext = originalName.includes('.') ? originalName.split('.').pop() : 'jpg';
  return `artists/${artistId}/avatar.${ext}`;
}
