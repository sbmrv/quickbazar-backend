import { z } from 'zod';
import { objectId } from '../admin/http.js';

const emptyQuery = z.object({}).strict();
const id = z.string().regex(objectId, 'Invalid id');

const deliveryRules = z
  .object({
    requiresFssai: z.boolean(),
    defaultDelivery: z
      .object({
        express: z.boolean(),
        sameDay: z.boolean(),
        standard: z.boolean(),
      })
      .strict(),
  })
  .strict();

const categoryBody = {
  name: z.string().trim().min(2).max(80),
  parentId: z.union([id, z.null()]).optional(),
  image: z.string().trim().max(500).optional(),
  sortOrder: z.number().int().min(0).max(10000),
  isActive: z.boolean(),
  rules: deliveryRules,
};

export const createCategorySchema = z.object({
  body: z.object(categoryBody).strict(),
  query: emptyQuery,
  params: z.object({}).strict(),
});

export const updateCategorySchema = z.object({
  body: z
    .object({
      name: categoryBody.name.optional(),
      parentId: categoryBody.parentId,
      image: categoryBody.image,
      sortOrder: categoryBody.sortOrder.optional(),
      isActive: categoryBody.isActive.optional(),
      rules: deliveryRules.optional(),
    })
    .strict()
    .refine((body) => Object.keys(body).length > 0, 'Nothing to update'),
  query: emptyQuery,
  params: z.object({ id }).strict(),
});

export const categoryIdSchema = z.object({
  body: z.preprocess((value) => value ?? {}, z.object({}).strict()),
  query: emptyQuery,
  params: z.object({ id }).strict(),
});
