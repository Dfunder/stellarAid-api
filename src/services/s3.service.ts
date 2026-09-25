/**
 * S3 client, scoped to what this feature area needs: deleting objects for
 * orphaned media (see `media-cleanup.service.ts`). Upload/presign belong to
 * whichever feature area owns media creation, not cleanup.
 */

import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { env } from '@/config';

let client: S3Client | undefined;

function getClient(): S3Client {
  if (client === undefined) {
    client = new S3Client({ region: env.s3Region });
  }
  return client;
}

export async function deleteObject(bucket: string, key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
