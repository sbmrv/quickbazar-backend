import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const blankToUndefined = (value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
};

const optionalString = z.preprocess(blankToUndefined, z.string().min(1).optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_URL: z.url().default('http://localhost:5173'),
  MONGO_URI: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().min(1).default('15m'),
  REFRESH_TOKEN_TTL: z.string().min(1).default('30d'),
  DATA_ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/i, '64 hex characters'),
  OTP_PROVIDER: z.enum(['console', 'msg91']).default('console'),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  ADMIN_SEED_EMAIL: z.email().default('admin@quickbazaar.test'),
  ADMIN_SEED_PASSWORD: z.string().min(8),
  RAZORPAY_KEY_ID: optionalString,
  RAZORPAY_KEY_SECRET: optionalString,
  RAZORPAY_WEBHOOK_SECRET: optionalString,
  PAYMENT_HOLD_MINUTES: z.coerce.number().int().positive().default(15),
  CLOUDINARY_CLOUD_NAME: optionalString,
  CLOUDINARY_API_KEY: optionalString,
  CLOUDINARY_API_SECRET: optionalString,
  GEOCODER: z.enum(['nominatim', 'google', 'mapbox', 'ola']).default('nominatim'),
  NOMINATIM_USER_AGENT: z.string().min(1).default('quickbazaar-dev (dev@localhost)'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const lines = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  process.stderr.write(`Invalid environment:\n${lines.join('\n')}\n`);
  process.exit(1);
}

export const env = parsed.data;
