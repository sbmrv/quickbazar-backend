import { logger } from '../utils/logger.js';
import { Category } from '../modules/categories/model.js';
import { ServiceArea } from '../modules/serviceAreas/model.js';
import { SETTING_KEYS, settingDefaults } from '../modules/settings/defaults.js';
import { Setting } from '../modules/settings/model.js';

const categories = [
  ['Grocery', 'grocery', true, true],
  ['Fruits & Veg', 'fruits-and-veg', true, true],
  ['Dairy', 'dairy', true, true],
  ['Snacks', 'snacks', true, true],
  ['Beverages', 'beverages', true, true],
  ['Personal Care', 'personal-care', false, true],
  ['Electronics', 'electronics', false, false],
  ['Home & Kitchen', 'home-and-kitchen', false, true],
  ['Fashion', 'fashion', false, false],
  ['Stationery', 'stationery', false, true],
];

const areas = [
  {
    city: 'Mumbai',
    name: 'Mumbai (city + near suburbs)',
    polygon: {
      type: 'Polygon',
      coordinates: [
        [
          [72.77, 18.89],
          [73.05, 18.89],
          [73.05, 19.3],
          [72.77, 19.3],
          [72.77, 18.89],
        ],
      ],
    },
  },
  {
    city: 'Pune',
    name: 'Pune (PMC + PCMC)',
    polygon: {
      type: 'Polygon',
      coordinates: [
        [
          [73.7, 18.4],
          [74, 18.4],
          [74, 18.75],
          [73.7, 18.75],
          [73.7, 18.4],
        ],
      ],
    },
  },
  {
    city: 'Navi Mumbai',
    name: 'Navi Mumbai',
    polygon: {
      type: 'Polygon',
      coordinates: [
        [
          [72.93, 18.88],
          [73.18, 18.88],
          [73.18, 19.12],
          [72.93, 19.12],
          [72.93, 18.88],
        ],
      ],
    },
  },
  {
    city: 'Khopoli',
    name: 'Khopoli',
    polygon: {
      type: 'Polygon',
      coordinates: [
        [
          [73.28, 18.74],
          [73.42, 18.74],
          [73.42, 18.84],
          [73.28, 18.84],
          [73.28, 18.74],
        ],
      ],
    },
  },
];

/**
 * Insert categories, service areas, and settings when they are missing.
 * Re-running does not overwrite admin edits.
 */
export async function seedMasterData() {
  for (const [index, [name, slug, requiresFssai, express]] of categories.entries()) {
    await Category.updateOne(
      { slug },
      {
        $setOnInsert: {
          name,
          slug,
          sortOrder: (index + 1) * 10,
          isActive: true,
          image: '',
          rules: {
            requiresFssai,
            defaultDelivery: { express, sameDay: true, standard: true },
          },
        },
      },
      { upsert: true },
    );
  }

  for (const area of areas) {
    await ServiceArea.updateOne(
      { city: area.city, name: area.name },
      { $setOnInsert: { ...area, isActive: true, codEnabled: true } },
      { upsert: true },
    );
  }

  for (const key of SETTING_KEYS) {
    await Setting.updateOne(
      { key },
      { $setOnInsert: { key, value: settingDefaults[key] } },
      { upsert: true },
    );
  }

  logger.info({ categories: categories.length, areas: areas.length }, 'master data seed complete');
}
