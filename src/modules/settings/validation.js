import { z } from 'zod';
import { SETTING_KEYS } from './defaults.js';

const emptyQuery = z.object({}).strict();
const clock = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, 'Use HH:mm')
  .transform((value) => value.slice(0, 5));
const paiseAmount = z.number().int().nonnegative();
const slot = z
  .object({ start: clock, end: clock })
  .strict()
  .refine((value) => value.end > value.start, 'Slot end must be after the start');

export const settingSchemas = {
  delivery: z
    .object({
      avgSpeedKmph: z.number().positive().max(80),
      roadFactor: z.number().positive().max(5),
      assignBufferMin: z.number().int().nonnegative().max(120),
    })
    .strict(),
  modes: z
    .object({
      express: z
        .object({
          enabled: z.boolean(),
          maxRadiusKm: z.number().positive().max(50),
          baseFeePaise: paiseAmount,
          perKmAfter2kmPaise: paiseAmount,
        })
        .strict(),
      sameDay: z
        .object({
          enabled: z.boolean(),
          maxRadiusKm: z.number().positive().max(100),
          baseFeePaise: paiseAmount,
          slots: z.array(slot).min(1).max(8),
          cutoff: clock,
        })
        .strict(),
      standard: z
        .object({
          enabled: z.boolean(),
          baseFeePaise: paiseAmount,
          maxBaseFeePaise: paiseAmount,
        })
        .strict()
        .refine((value) => value.maxBaseFeePaise >= value.baseFeePaise, 'Max fee must cover the base fee'),
    })
    .strict(),
  fees: z
    .object({
      freeDeliveryAbovePaise: paiseAmount,
      smallCartBelowPaise: paiseAmount,
      smallCartFeePaise: paiseAmount,
      handlingFeePaise: paiseAmount,
    })
    .strict(),
  cod: z
    .object({
      enabled: z.boolean(),
      maxOrderValuePaise: paiseAmount,
      codFeePaise: paiseAmount,
      disableAfterStrikes: z.number().int().positive().max(20),
    })
    .strict(),
  seller: z
    .object({
      defaultCommissionPct: z.number().min(0).max(100),
      acceptTimeoutSec: z.number().int().positive().max(3600),
    })
    .strict(),
  rider: z
    .object({
      offerTimeoutSec: z.number().int().positive().max(300),
      offerRadiusKmSteps: z.array(z.number().positive().max(50)).min(1).max(5),
      basePayPaise: paiseAmount,
      perKmPaise: paiseAmount,
    })
    .strict(),
};

export const updateSettingSchema = z.object({
  body: z.unknown(),
  query: emptyQuery,
  params: z.object({ key: z.enum(SETTING_KEYS) }).strict(),
});
