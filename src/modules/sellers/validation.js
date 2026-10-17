import { z } from 'zod';
import { objectId } from '../admin/http.js';
import { INDIAN_MOBILE, normalizePhone } from '../auth/phone.js';

const id = z.string().regex(objectId, 'Invalid id');
const clock = /^([01]\d|2[0-3]):[0-5]\d$/;
const pan = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const gstin = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const ifsc = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const fssai = /^\d{14}$/;

const imageUrl = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((value) => value.startsWith('/uploads/') || value.startsWith('https://'), 'Use an uploaded image');

const doc = z
  .object({
    label: z.string().trim().min(2).max(40),
    url: imageUrl,
  })
  .strict();

const kyc = z
  .object({
    pan: z.string().trim().toUpperCase().regex(pan, 'Enter a valid PAN'),
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .refine((value) => value === '' || gstin.test(value), 'Enter a valid GSTIN')
      .optional(),
    fssai: z
      .string()
      .trim()
      .refine((value) => value === '' || fssai.test(value), 'Enter a 14-digit FSSAI number')
      .optional(),
    docs: z.array(doc).max(5).optional(),
  })
  .strict();

const bank = z
  .object({
    holderName: z.string().trim().min(2).max(80),
    accountNo: z.string().trim().regex(/^\d{9,18}$/, 'Enter the account number'),
    ifsc: z.string().trim().toUpperCase().regex(ifsc, 'Enter a valid IFSC'),
  })
  .strict();

const bankUpdate = z
  .object({
    holderName: z.string().trim().min(2).max(80),
    accountNo: z.string().trim().regex(/^\d{9,18}$/, 'Enter the account number').optional(),
    ifsc: z.string().trim().toUpperCase().regex(ifsc, 'Enter a valid IFSC'),
  })
  .strict();

export const applySchema = z.object({
  body: z
    .object({
      businessName: z.string().trim().min(2).max(120),
      type: z.enum(['dark_store', 'retail_store', 'individual']),
      kyc,
      bank,
    })
    .strict(),
  query: z.object({}).strict(),
  params: z.object({}).strict(),
});

export const updateProfileSchema = z.object({
  body: z
    .object({
      businessName: z.string().trim().min(2).max(120),
      type: z.enum(['dark_store', 'retail_store', 'individual']),
      kyc,
      bank: bankUpdate,
    })
    .strict(),
  query: z.object({}).strict(),
  params: z.object({}).strict(),
});

const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(['pending', 'approved', 'rejected', 'suspended']).optional(),
};

export const listSellersSchema = z.object({
  body: z.object({}).strict(),
  query: z.object(pageQuery).strict(),
  params: z.object({}).strict(),
});

export const sellerIdSchema = z.object({
  body: z.object({}).strict(),
  query: z.object({}).strict(),
  params: z.object({ id }).strict(),
});

export const patchSellerSchema = z.object({
  body: z
    .object({
      commissionPct: z.number().min(0).max(100).nullable().optional(),
      autoApproveProducts: z.boolean().optional(),
    })
    .strict(),
  query: z.object({}).strict(),
  params: z.object({ id }).strict(),
});

export const approveSellerSchema = z.object({
  body: z
    .object({
      commissionPct: z.number().min(0).max(100).nullable().optional(),
      autoApproveProducts: z.boolean().optional(),
    })
    .strict(),
  query: z.object({}).strict(),
  params: z.object({ id }).strict(),
});

export const reasonSchema = z.object({
  body: z
    .object({
      reason: z.string().trim().min(3).max(300),
    })
    .strict(),
  query: z.object({}).strict(),
  params: z.object({ id }).strict(),
});

export const hourSchema = z
  .object({
    day: z.number().int().min(0).max(6),
    open: z.string().regex(clock, 'Use HH:mm'),
    close: z.string().regex(clock, 'Use HH:mm'),
  })
  .strict()
  .refine((hour) => hour.close > hour.open, { message: 'Closing time must be after opening time' });

export const pointSchema = z
  .object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number().gte(-180).lte(180), z.number().gte(-90).lte(90)]),
  })
  .strict();

const storeBody = {
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().transform(normalizePhone).pipe(z.string().regex(INDIAN_MOBILE, 'Enter a valid mobile number')),
  address: z
    .object({
      line1: z.string().trim().min(3).max(160),
      line2: z.string().trim().max(160).optional(),
      landmark: z.string().trim().max(80).optional(),
      pincode: z.string().trim().regex(/^\d{6}$/, 'Enter a 6-digit pincode'),
    })
    .strict(),
  location: pointSchema,
  radiusKm: z
    .object({
      express: z.number().gt(0).lte(30),
      sameDay: z.number().gt(0).lte(40),
      standard: z.number().gt(0).lte(80),
    })
    .strict(),
  prepTimeMin: z.number().int().min(1).max(180),
  busyExtraMin: z.number().int().min(0).max(180).optional(),
  hours: z.array(hourSchema).min(1).max(7),
  isOpen: z.boolean(),
  acceptingOrders: z.boolean(),
};

export const createStoreSchema = z.object({
  body: z.object(storeBody).strict(),
  query: z.object({}).strict(),
  params: z.object({}).strict(),
});

export const updateStoreSchema = z.object({
  body: z.object(storeBody).strict(),
  query: z.object({}).strict(),
  params: z.object({ id }).strict(),
});

export const storeIdSchema = z.object({
  body: z.object({}).strict(),
  query: z.object({}).strict(),
  params: z.object({ id }).strict(),
});

const delivery = z
  .object({
    express: z.boolean(),
    sameDay: z.boolean(),
    standard: z.boolean(),
  })
  .strict()
  .refine((mode) => mode.express || mode.sameDay || mode.standard, {
    message: 'Turn on at least one delivery mode',
  });

const variant = z
  .object({
    sku: z.string().trim().min(1).max(40),
    label: z.string().trim().max(40).optional(),
    mrpPaise: z.number().int().min(0),
    pricePaise: z.number().int().min(0),
    stock: z.number().int().min(0),
    weightGrams: z.number().int().min(1).max(50000),
    barcode: z.string().trim().max(40).optional(),
  })
  .strict()
  .refine((item) => item.pricePaise <= item.mrpPaise, { message: 'Price cannot be above MRP' });

const productBody = {
  storeId: id,
  categoryId: id,
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  brand: z.string().trim().max(80).optional(),
  images: z.array(imageUrl).min(1).max(6),
  attributes: z.record(z.string().max(40), z.string().max(80)).optional(),
  variants: z.array(variant).min(1).max(8),
  gstPct: z.number().int().min(0).max(40),
  hsn: z.string().trim().max(12).optional(),
  delivery,
  handlingTimeMin: z.number().int().min(0).max(1440),
  maxExpressDistanceKm: z.number().gt(0).lte(50).nullable().optional(),
  flags: z
    .object({
      fragile: z.boolean(),
      perishable: z.boolean(),
      veg: z.boolean().nullable(),
    })
    .strict(),
  returnWindowDays: z.number().int().min(0).max(30),
};

export const createProductSchema = z.object({
  body: z.object(productBody).strict(),
  query: z.object({}).strict(),
  params: z.object({}).strict(),
});

export const updateProductSchema = z.object({
  body: z.object(productBody).strict(),
  query: z.object({}).strict(),
  params: z.object({ id }).strict(),
});

export const productIdSchema = z.object({
  body: z.object({}).strict(),
  query: z.object({}).strict(),
  params: z.object({ id }).strict(),
});

export const stockSchema = z.object({
  body: z
    .object({
      sku: z.string().trim().min(1).max(40),
      stock: z.number().int().min(0),
    })
    .strict(),
  query: z.object({}).strict(),
  params: z.object({ id }).strict(),
});

export const listProductsSchema = z.object({
  body: z.object({}).strict(),
  query: z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    })
    .strict(),
  params: z.object({}).strict(),
});

export const moderationSchema = z.object({
  body: z.object({}).strict(),
  query: z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20),
      status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
    })
    .strict(),
  params: z.object({}).strict(),
});
