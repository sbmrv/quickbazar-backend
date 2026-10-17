import { z } from 'zod';
import { objectId } from '../admin/http.js';
import { INDIAN_MOBILE, normalizePhone } from '../auth/phone.js';
import { pointSchema } from '../sellers/validation.js';

const id = z.string().regex(objectId, 'Invalid id');

const addressBody = z
  .object({
    label: z.string().trim().min(1).max(40),
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().transform(normalizePhone).pipe(z.string().regex(INDIAN_MOBILE, 'Enter a valid mobile number')),
    line1: z.string().trim().min(3).max(160),
    line2: z.string().trim().max(160).optional(),
    landmark: z.string().trim().max(80).optional(),
    pincode: z.string().trim().regex(/^\d{6}$/, 'Enter a 6-digit pincode'),
    location: pointSchema,
    isDefault: z.boolean().optional(),
  })
  .strict();

const empty = z.object({}).strict();

export const createAddressSchema = z.object({ body: addressBody, query: empty, params: empty });
export const updateAddressSchema = z.object({
  body: addressBody,
  query: empty,
  params: z.object({ id }).strict(),
});
export const addressIdSchema = z.object({ body: empty, query: empty, params: z.object({ id }).strict() });

const line = z
  .object({
    productId: id,
    sku: z.string().trim().min(1).max(40),
    qty: z.number().int().min(1).max(20),
  })
  .strict();

export const putCartSchema = z.object({
  body: z.object({ items: z.array(line).max(30) }).strict(),
  query: z
    .object({
      lat: z.coerce.number().gte(-90).lte(90),
      lng: z.coerce.number().gte(-180).lte(180),
    })
    .strict(),
  params: empty,
});

export const getCartSchema = z.object({
  body: empty,
  query: z
    .object({
      lat: z.coerce.number().gte(-90).lte(90),
      lng: z.coerce.number().gte(-180).lte(180),
    })
    .strict(),
  params: empty,
});

export const quoteSchema = z.object({
  body: z
    .object({
      addressId: id,
      modes: z.record(z.string(), z.enum(['EXPRESS', 'SAME_DAY', 'STANDARD'])).optional(),
      couponCode: z.string().trim().max(40).optional(),
      paymentMethod: z.enum(['COD', 'ONLINE']).optional(),
    })
    .strict(),
  query: empty,
  params: empty,
});

export const placeOrderSchema = z.object({
  body: z
    .object({
      addressId: id,
      modes: z.record(z.string(), z.enum(['EXPRESS', 'SAME_DAY', 'STANDARD'])).optional(),
      expectedGrandTotalPaise: z.number().int().min(0).optional(),
      paymentMethod: z.enum(['COD', 'ONLINE']).default('COD'),
      couponCode: z.string().trim().max(40).optional(),
    })
    .strict(),
  query: empty,
  params: empty,
});

export const listOrdersSchema = z.object({
  body: empty,
  query: z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    })
    .strict(),
  params: empty,
});
