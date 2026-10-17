import { z } from 'zod';

export const listAuditSchema = z.object({
  body: z.preprocess((value) => value ?? {}, z.object({}).strict()),
  params: z.object({}).strict(),
  query: z
    .object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(50).default(20),
    })
    .strict(),
});
