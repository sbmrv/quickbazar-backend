import { connectDb, disconnectDb } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { seedEngagement } from './engagement.js';
import { seedAuthUsers } from './authUsers.js';
import { seedCatalog } from './catalog.js';
import { seedMasterData } from './masterData.js';

try {
  await connectDb();
  await seedAuthUsers();
  await seedMasterData();
  await seedCatalog();
  await seedEngagement();
} catch (err) {
  logger.error({ err }, 'seed failed');
  process.exitCode = 1;
} finally {
  await disconnectDb();
}
