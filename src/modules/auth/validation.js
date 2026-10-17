import { z } from 'zod';
import { INDIAN_MOBILE, normalizePhone } from './phone.js';

const phone = z
  .string()
  .trim()
  .transform(normalizePhone)
  .pipe(z.string().regex(INDIAN_MOBILE, 'Enter a valid 10-digit mobile number'));

const emptyQuery = z.object({}).strict();

export const requestOtpSchema = z.object({
  body: z.object({ phone }).strict(),
  query: emptyQuery,
  params: z.object({}).strict(),
});

export const verifyOtpSchema = z.object({
  body: z
    .object({
      phone,
      otp: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
    })
    .strict(),
  query: emptyQuery,
  params: z.object({}).strict(),
});

export const adminLoginSchema = z.object({
  body: z
    .object({
      email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email')),
      password: z.string().min(8).max(200),
    })
    .strict(),
  query: emptyQuery,
  params: z.object({}).strict(),
});

export const enableRoleSchema = z.object({
  body: z.preprocess((value) => value ?? {}, z.object({}).strict()),
  query: emptyQuery,
  params: z.object({ role: z.enum(['seller', 'rider']) }).strict(),
});
