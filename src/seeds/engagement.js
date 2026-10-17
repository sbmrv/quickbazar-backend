import { logger } from '../utils/logger.js';
import { User } from '../modules/auth/model.js';
import { Coupon } from '../modules/coupons/model.js';
import { Rider } from '../modules/riders/model.js';

export async function seedEngagement() {
  await Coupon.updateOne(
    { code: 'WELCOME10' },
    {
      $setOnInsert: {
        code: 'WELCOME10',
        kind: 'percent',
        value: 10,
        maxDiscountPaise: 10000,
        minCartPaise: 0,
        perUserLimit: 1,
        globalLimit: 0,
        firstOrderOnly: false,
        isActive: true,
      },
    },
    { upsert: true },
  );
  const user = await User.findOne({ phone: '9000000003' }).lean();
  if (user) {
    await Rider.updateOne(
      { userId: user._id },
      { $setOnInsert: { userId: user._id, city: 'Mumbai', vehicleType: 'bike', vehicleNo: 'MH01AB1234', status: 'approved', availability: 'offline' } },
      { upsert: true },
    );
  }
  logger.info('engagement seed ready');
}
