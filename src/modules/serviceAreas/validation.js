import { z } from 'zod';
import { objectId } from '../admin/http.js';
import { parsePolygon } from './polygon.js';

const emptyQuery = z.object({}).strict();
const id = z.string().regex(objectId, 'Invalid id');

const polygonSchema = z.any().transform((value, ctx) => {
  const parsed = parsePolygon(value);
  if (!parsed.ok) {
    ctx.addIssue({ code: 'custom', message: parsed.message });
    return z.NEVER;
  }
  return parsed.polygon;
});

const fields = {
  city: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(80),
  polygon: polygonSchema,
  isActive: z.boolean(),
  codEnabled: z.boolean(),
};

export const createServiceAreaSchema = z.object({
  body: z.object(fields).strict(),
  query: emptyQuery,
  params: z.object({}).strict(),
});

export const updateServiceAreaSchema = z.object({
  body: z
    .object({
      city: fields.city.optional(),
      name: fields.name.optional(),
      polygon: fields.polygon.optional(),
      isActive: fields.isActive.optional(),
      codEnabled: fields.codEnabled.optional(),
    })
    .strict()
    .refine((body) => Object.keys(body).length > 0, 'Nothing to update'),
  query: emptyQuery,
  params: z.object({ id }).strict(),
});

export const serviceAreaIdSchema = z.object({
  body: z.preprocess((value) => value ?? {}, z.object({}).strict()),
  query: emptyQuery,
  params: z.object({ id }).strict(),
});
