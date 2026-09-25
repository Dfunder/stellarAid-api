/**
 * Media upload request schemas.
 */

import { z } from 'zod';

import { uuidSchema } from './common.schemas';

const BYTES_PER_MB = 1024 * 1024;
export const MAX_IMAGE_SIZE_BYTES = 10 * BYTES_PER_MB;
export const MAX_DIGITAL_FILE_SIZE_BYTES = 100 * BYTES_PER_MB;

export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ALLOWED_DIGITAL_FILE_MIME_TYPES = [
  'application/zip',
  'application/x-zip-compressed',
  'application/pdf',
  'application/postscript', // .ai
  'image/vnd.adobe.photoshop', // .psd
] as const;

export const mediaParentTypeSchema = z.enum(['ARTWORK', 'PORTFOLIO']);

export const presignUploadSchema = z
  .object({
    type: z.enum(['IMAGE', 'DIGITAL_FILE']),
    mimeType: z.string().trim().min(1).max(255),
    filename: z.string().trim().min(1).max(255),
    size: z.coerce.number().int().positive(),
    parentType: mediaParentTypeSchema.optional(),
    parentId: uuidSchema.optional(),
  })
  .refine((body) => (body.parentType === undefined) === (body.parentId === undefined), {
    message: 'parentType and parentId must be provided together.',
    path: ['parentId'],
  })
  .superRefine((body, ctx) => {
    const allowedTypes: readonly string[] =
      body.type === 'IMAGE' ? ALLOWED_IMAGE_MIME_TYPES : ALLOWED_DIGITAL_FILE_MIME_TYPES;
    if (!allowedTypes.includes(body.mimeType)) {
      ctx.addIssue({
        code: 'custom',
        path: ['mimeType'],
        message: `mimeType must be one of: ${allowedTypes.join(', ')}`,
      });
    }

    const maxSize = body.type === 'IMAGE' ? MAX_IMAGE_SIZE_BYTES : MAX_DIGITAL_FILE_SIZE_BYTES;
    if (body.size > maxSize) {
      ctx.addIssue({
        code: 'custom',
        path: ['size'],
        message: `size must not exceed ${maxSize} bytes for type ${body.type}.`,
      });
    }
  });

export const mediaIdParamsSchema = z.object({ id: uuidSchema });

export type PresignUploadSchema = z.infer<typeof presignUploadSchema>;
export type MediaIdParamsSchema = z.infer<typeof mediaIdParamsSchema>;
