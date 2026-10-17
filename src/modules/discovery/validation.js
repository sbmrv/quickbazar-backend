import { z } from 'zod';

const coords = {
  lat: z.coerce.number().gte(-90).lte(90),
  lng: z.coerce.number().gte(-180).lte(180),
};

export const serviceabilitySchema = z.object({
  body: z.object({}).strict(),
  query: z.object(coords).strict(),
  params: z.object({}).strict(),
});

export const homeSchema = serviceabilitySchema;

export const listDiscoverySchema = z.object({
  body: z.object({}).strict(),
  query: z
    .object({
      ...coords,
      q: z.string().trim().max(80).optional(),
      category: z.string().trim().max(80).optional(),
      brand: z.string().trim().max(80).optional(),
      minPrice: z.coerce.number().int().min(0).optional(),
      maxPrice: z.coerce.number().int().min(0).optional(),
      maxEtaMin: z.coerce.number().int().min(1).max(10000).optional(),
      mode: z.enum(['EXPRESS', 'SAME_DAY', 'STANDARD']).optional(),
      rating: z.coerce.number().min(0).max(5).optional(),
      inStock: z.enum(['true', 'false']).optional(),
      sort: z.enum(['fastest', 'nearest', 'price_asc', 'price_desc', 'rating', 'newest']).default('fastest'),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    })
    .strict(),
  params: z.object({}).strict(),
});

export const productDiscoverySchema = z.object({
  body: z.object({}).strict(),
  query: z.object(coords).strict(),
  params: z.object({ id: z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id') }).strict(),
});

export const waitlistSchema = z.object({
  body: z
    .object({
      phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid mobile number'),
      lat: z.number().gte(-90).lte(90),
      lng: z.number().gte(-180).lte(180),
      note: z.string().trim().max(200).optional(),
    })
    .strict(),
  query: z.object({}).strict(),
  params: z.object({}).strict(),
});

export const searchSchema = z.object({
  body: z.object({}).strict(),
  query: z.object({ q: z.string().trim().min(2).max(80) }).strict(),
  params: z.object({}).strict(),
});
