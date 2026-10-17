import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { User } from '../modules/auth/model.js';

const testUsers = [
  { phone: '9000000001', name: 'Test Buyer', roles: ['buyer'] },
  { phone: '9000000002', name: 'Test Seller', roles: ['buyer', 'seller'] },
  { phone: '9000000003', name: 'Test Rider', roles: ['buyer', 'rider'] },
];

/**
 * Upsert the admin and the three phone fixtures. Safe to run again.
 */
export async function seedAuthUsers() {
  const passwordHash = await bcrypt.hash(env.ADMIN_SEED_PASSWORD, 12);
  await User.updateOne(
    { email: env.ADMIN_SEED_EMAIL },
    {
      $set: {
        name: 'QuickBazaar Admin',
        roles: ['admin'],
        adminRole: 'super',
        status: 'active',
        passwordHash,
      },
      $setOnInsert: { email: env.ADMIN_SEED_EMAIL },
    },
    { upsert: true },
  );

  for (const person of testUsers) {
    await User.updateOne(
      { phone: person.phone },
      {
        $set: { name: person.name, roles: person.roles, status: 'active', pendingRoles: [] },
        $setOnInsert: { phone: person.phone },
      },
      { upsert: true },
    );
  }

  logger.info(
    { admin: env.ADMIN_SEED_EMAIL, phones: testUsers.map((person) => person.phone) },
    'auth seed complete',
  );
}
