import 'dotenv/config';
import mongoose from 'mongoose';
import Redis from 'ioredis';

try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  console.log('✅ MongoDB connected | replica set:', hello.setName ?? 'NONE (transactions will NOT work)');
} catch (e) {
  console.error('❌ MongoDB failed:', e.message);
  process.exitCode = 1;
}

try {
  const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
  await redis.connect();
  console.log('✅ Redis connected | PING ->', await redis.ping());
  await redis.geoadd('smoke:geo', 72.8777, 19.076, 'mumbai');
  const near = await redis.geosearch('smoke:geo', 'FROMLONLAT', 72.88, 19.07, 'BYRADIUS', 10, 'km', 'ASC');
  console.log('✅ Redis GEOSEARCH works ->', near);
  await redis.del('smoke:geo');
  await redis.quit();
} catch (e) {
  console.error('❌ Redis failed:', e.message);
  process.exitCode = 1;
}

await mongoose.disconnect();