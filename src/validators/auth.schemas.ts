/**
 * Auth request schemas.
 */

import { z } from 'zod';
import { emailSchema } from './common.schemas';




export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(120),
  email: emailSchema,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(128)
    .regex(/[a-z]/, 'Password must contain a lowercase letter.')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter.'),
  role: z.enum(['USER', 'ARTIST']).default('USER'),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required.').max(128),
});

export const refreshSchema = z.object({
  refreshToken: z.string().trim().min(1, 'refreshToken is required.'),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, 'token is required.'),
  password: registerSchema.shape.password,
export const logoutSchema = z.object({
  refreshToken: z.string().trim().min(1, 'refreshToken is required.'),
});

export const verifyEmailSchema = z.object({
  token: z.string().trim().min(1, 'token is required.'),
});

export type RegisterSchema = z.infer<typeof registerSchema>;
export type LoginSchema = z.infer<typeof loginSchema>;
export type RefreshSchema = z.infer<typeof refreshSchema>;
export type ForgotPasswordSchema = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>;
export type LogoutSchema = z.infer<typeof logoutSchema>;
export type VerifyEmailSchema = z.infer<typeof verifyEmailSchema>;
