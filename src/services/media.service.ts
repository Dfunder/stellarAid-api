/**
 * Media upload service.
 *
 * Issues a presigned S3 upload URL and creates the corresponding `Media`
 * record. The client uploads the file bytes directly to S3 using the
 * returned URL; this service never touches the file body.
 */

import { env } from '@/config';
import { AppError } from '@/middlewares';
import { enqueueImageProcessing } from '@/queues';
import { prisma } from '@/services';

import { buildObjectKey, buildPublicUrl, createPresignedUploadUrl } from './s3.service';

export interface PresignUploadInput {
  readonly type: 'IMAGE' | 'DIGITAL_FILE';
  readonly mimeType: string;
  readonly filename: string;
  readonly size: number;
  readonly parentType?: 'ARTWORK' | 'PORTFOLIO';
  readonly parentId?: string;
}

export interface PresignUploadResult {
  readonly mediaId: string;
  readonly uploadUrl: string;
  readonly key: string;
  readonly expiresInSeconds: number;
}

const PRESIGNED_UPLOAD_TTL_SECONDS = 300;

async function assertParentOwnership(
  userId: string,
  parentType: 'ARTWORK' | 'PORTFOLIO',
  parentId: string,
): Promise<void> {
  if (parentType === 'ARTWORK') {
    const artwork = await prisma.artwork.findUnique({ where: { id: parentId } });
    if (artwork === null) {
      throw new AppError('NOT_FOUND', 'Artwork not found');
    }
    if (artwork.userId !== userId) {
      throw new AppError('FORBIDDEN', 'You do not own this artwork');
    }
  } else {
    const item = await prisma.portfolioItem.findUnique({ where: { id: parentId } });
    if (item === null) {
      throw new AppError('NOT_FOUND', 'Portfolio item not found');
    }
    if (item.userId !== userId) {
      throw new AppError('FORBIDDEN', 'You do not own this portfolio item');
    }
  }
}

/**
 * Creates the `Media` record and, when a parent is given, links it via the
 * appropriate join table — before the file itself has been uploaded. The
 * presigned URL expires in `PRESIGNED_UPLOAD_TTL_SECONDS`; if the client
 * never uploads, the `Media` row is orphaned and handled by the same
 * cleanup sweep described in the schema for deleted parents.
 */
export async function presignMediaUpload(
  userId: string,
  input: PresignUploadInput,
): Promise<PresignUploadResult> {
  if (input.parentType !== undefined && input.parentId !== undefined) {
    await assertParentOwnership(userId, input.parentType, input.parentId);
  }

  const folder = input.type === 'IMAGE' ? 'images' : 'digital-files';
  const key = buildObjectKey(userId, folder, input.filename);

  const media = await prisma.media.create({
    data: {
      userId,
      type: input.type,
      bucket: env.s3Bucket ?? '',
      key,
      mimeType: input.mimeType,
      size: BigInt(input.size),
    },
  });

  if (input.parentType === 'ARTWORK' && input.parentId !== undefined) {
    await prisma.artworkMedia.create({
      data: { artworkId: input.parentId, mediaId: media.id },
    });
  } else if (input.parentType === 'PORTFOLIO' && input.parentId !== undefined) {
    await prisma.portfolioMedia.create({
      data: { portfolioItemId: input.parentId, mediaId: media.id },
    });
  }

  const uploadUrl = await createPresignedUploadUrl(key, input.mimeType);

  return {
    mediaId: media.id,
    uploadUrl,
    key,
    expiresInSeconds: PRESIGNED_UPLOAD_TTL_SECONDS,
  };
}

export interface MediaVariant {
  readonly label: string;
  readonly url: string;
  readonly width: number | null;
  readonly height: number | null;
}

export interface MediaRecord {
  readonly id: string;
  readonly type: 'IMAGE' | 'DIGITAL_FILE';
  readonly url: string;
  readonly mimeType: string;
  readonly size: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly variants: readonly MediaVariant[];
  readonly createdAt: Date;
}

async function toMediaRecord(media: {
  id: string;
  type: 'IMAGE' | 'DIGITAL_FILE';
  key: string;
  mimeType: string;
  size: bigint;
  width: number | null;
  height: number | null;
  createdAt: Date;
}): Promise<MediaRecord> {
  const variants = await prisma.media.findMany({ where: { variantOfId: media.id } });
  return {
    id: media.id,
    type: media.type,
    url: buildPublicUrl(media.key),
    mimeType: media.mimeType,
    size: media.size.toString(),
    width: media.width,
    height: media.height,
    createdAt: media.createdAt,
    variants: variants.map((v) => ({
      label: v.variantLabel ?? 'variant',
      url: buildPublicUrl(v.key),
      width: v.width,
      height: v.height,
    })),
  };
}

/**
 * Marks an upload as finished and, for images, enqueues thumbnail/WebP
 * generation. There's no way to verify the object actually landed in S3
 * from here (that would need a HEAD request); the worker itself fails the
 * job gracefully if the object is missing.
 */
export async function confirmMediaUpload(userId: string, mediaId: string): Promise<MediaRecord> {
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (media === null) {
    throw new AppError('NOT_FOUND', 'Media not found');
  }
  if (media.userId !== userId) {
    throw new AppError('FORBIDDEN', 'You do not own this media');
  }

  if (media.type === 'IMAGE' && media.variantOfId === null) {
    await enqueueImageProcessing(media.id);
  }

  return toMediaRecord(media);
}

export async function getMediaRecord(mediaId: string): Promise<MediaRecord> {
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (media === null) {
    throw new AppError('NOT_FOUND', 'Media not found');
  }
  return toMediaRecord(media);
}
