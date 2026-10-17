import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * Connect Mongoose using MONGO_URI. Fails fast when Mongo is unreachable.
 */
export async function connectDb() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  logger.info('mongodb connected');
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
