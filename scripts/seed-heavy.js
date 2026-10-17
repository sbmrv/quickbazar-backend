import { connectDb, disconnectDb } from '../src/config/db.js';
import { Category } from '../src/modules/categories/model.js';
import { Product } from '../src/modules/products/model.js';
import { Store } from '../src/modules/stores/model.js';

await connectDb();
const category = await Category.findOne().lean();
const stores = await Store.find({ status: 'active' }).limit(12).lean();
if (stores.length === 0) {
  process.stderr.write('Run npm run seed first.\n');
  process.exitCode = 1;
} else {
  const docs = [];
  for (let index = 0; index < 10000; index += 1) {
    const store = stores[index % stores.length];
    docs.push({
      sellerId: store.sellerId,
      storeId: store._id,
      categoryId: category?._id,
      name: `Load item ${index}`,
      slug: `load-item-${index}`,
      description: 'Load test product',
      brand: 'Load',
      images: ['https://placehold.co/400x400/png?text=Load'],
      variants: [{ sku: `LOAD-${index}`, label: 'One', mrpPaise: 10000, pricePaise: 9000, stock: 20, reservedStock: 0, weightGrams: 100 }],
      gstPct: 0,
      delivery: { express: true, sameDay: true, standard: true },
      handlingTimeMin: 5,
      approvalStatus: 'approved',
      isActive: true,
    });
  }
  await Product.insertMany(docs, { ordered: false }).catch(() => {});
  process.stdout.write('heavy seed attempted 10000 products\n');
}
await disconnectDb();
process.exit(process.exitCode ?? 0);
