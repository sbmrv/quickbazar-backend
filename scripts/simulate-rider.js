import { connectDb, disconnectDb } from '../src/config/db.js';
import { ingestLocation } from '../src/modules/riders/location.js';
import { User } from '../src/modules/auth/model.js';
import { Rider } from '../src/modules/riders/model.js';
import { Shipment } from '../src/modules/orders/model.js';
import { Store } from '../src/modules/stores/model.js';

const shipmentId = process.argv[process.argv.indexOf('--shipment') + 1];

await connectDb();
const shipment = await Shipment.findById(shipmentId);
const rider = shipment ? await Rider.findById(shipment.riderId) : null;
const store = shipment ? await Store.findById(shipment.storeId).lean() : null;
if (!shipment || !rider || !store) {
  process.stderr.write('Pass --shipment <id> for a shipment that already has a rider.\n');
  process.exitCode = 1;
} else {
  const user = await User.findById(rider.userId).lean();
  const [lng, lat] = store.location.coordinates;
  for (let step = 0; step <= 8; step += 1) {
    await ingestLocation(String(user._id), {
      lng: lng + step * 0.001,
      lat: lat - step * 0.0005,
      accuracy: 10,
      speed: 5,
      ts: Date.now(),
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
await disconnectDb();
process.exit(0);
