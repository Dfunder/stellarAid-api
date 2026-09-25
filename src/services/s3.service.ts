/**
 * S3 client and presigned URL helpers.
 *
 * A single S3Client is shared across the process, matching the Prisma
 * client singleton pattern in `prisma.service.ts`.
 */

import { randomUUID } from 'node:crypto';

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'node:stream';

import { env } from '@/config';

const PRESIGNED_UPLOAD_EXPIRY_SECONDS = 300;
const PRESIGNED_DOWNLOAD_EXPIRY_SECONDS = 3600;

export const s3Client = new S3Client({ region: env.s3Region ?? 'us-east-1' });

/** Build a namespaced, collision-resistant object key. */
export function buildObjectKey(userId: string, folder: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${folder}/${userId}/${randomUUID()}-${safeName}`;
}

/** Presigned PUT URL the client uploads the file to directly. */
export async function createPresignedUploadUrl(
  key: string,
  contentType: string,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: env.s3Bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3Client, command, { expiresIn: PRESIGNED_UPLOAD_EXPIRY_SECONDS });
}

/** Presigned GET URL for reading a private object (e.g. digital deliverables). */
export async function createPresignedDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: env.s3Bucket, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn: PRESIGNED_DOWNLOAD_EXPIRY_SECONDS });
}

/** Public, non-expiring URL for objects served from a public bucket/CDN. */
export function buildPublicUrl(key: string): string {
  return `https://${env.s3Bucket}.s3.${env.s3Region ?? 'us-east-1'}.amazonaws.com/${key}`;
}

/** Upload a buffer directly (used by the image-processing worker for variants). */
export async function uploadObjectBuffer(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({ Bucket: env.s3Bucket, Key: key, Body: body, ContentType: contentType }),
  );
}

/** Download an object's full body as a buffer (used by the image-processing worker). */
export async function downloadObjectBuffer(key: string): Promise<Buffer> {
  const result = await s3Client.send(new GetObjectCommand({ Bucket: env.s3Bucket, Key: key }));
  const stream = result.Body as Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}
