import { logger } from '../utils/logger.js';
import { encryptString } from '../utils/crypto.js';
import { User } from '../modules/auth/model.js';
import { Category } from '../modules/categories/model.js';
import { slugify } from '../modules/categories/tree.js';
import { Product } from '../modules/products/model.js';
import { Seller } from '../modules/sellers/model.js';
import { ServiceArea } from '../modules/serviceAreas/model.js';
import { Store } from '../modules/stores/model.js';

const names = [
  'Full cream milk 1L',
  'Brown bread',
  'Bananas 1 dozen',
  'Tomatoes 500g',
  'Salted chips',
  'Orange juice 1L',
  'Bathing soap',
  'Wired earphones',
  'Steel bottle',
  'Cotton t-shirt',
  'Notebook pack',
  'Basmati rice 1kg',
  'Curd 400g',
  'Green tea box',
  'Hand wash',
  'LED bulb',
  'Floor cleaner',
  'Ball pen set',
];

const places = [
  { phone: '9000000002', owner: 'Test Seller', store: 'Andheri Fresh', area: 'Andheri West', lat: 19.1363, lng: 72.8277, pincode: '400058', city: 'Mumbai', products: 18, autoApprove: false },
  { phone: '9100000001', owner: 'Bandra Seller', store: 'Bandra Daily', area: 'Bandra West', lat: 19.0596, lng: 72.8295, pincode: '400050', city: 'Mumbai', products: 12, autoApprove: true },
  { phone: '9100000002', owner: 'Powai Seller', store: 'Powai Grocer', area: 'Powai', lat: 19.1176, lng: 72.906, pincode: '400076', city: 'Mumbai', products: 12, autoApprove: false },
  { phone: '9100000003', owner: 'Dadar Seller', store: 'Dadar Mart', area: 'Dadar', lat: 19.0178, lng: 72.8478, pincode: '400014', city: 'Mumbai', products: 12, autoApprove: false },
  { phone: '9100000004', owner: 'Borivali Seller', store: 'Borivali Store', area: 'Borivali', lat: 19.2307, lng: 72.8567, pincode: '400066', city: 'Mumbai', products: 12, autoApprove: false },
  { phone: '9100000005', owner: 'Colaba Seller', store: 'Colaba Needs', area: 'Colaba', lat: 18.9067, lng: 72.8147, pincode: '400005', city: 'Mumbai', products: 12, autoApprove: false },
  { phone: '9100000006', owner: 'KP Seller', store: 'KP Provisions', area: 'Koregaon Park', lat: 18.5362, lng: 73.894, pincode: '411001', city: 'Pune', products: 12, autoApprove: false },
  { phone: '9100000007', owner: 'Kothrud Seller', store: 'Kothrud Basket', area: 'Kothrud', lat: 18.5074, lng: 73.8077, pincode: '411038', city: 'Pune', products: 12, autoApprove: false },
  { phone: '9100000008', owner: 'Hinjewadi Seller', store: 'Hinjewadi Mart', area: 'Hinjewadi', lat: 18.5912, lng: 73.7389, pincode: '411057', city: 'Pune', products: 12, autoApprove: false },
  { phone: '9100000009', owner: 'Viman Nagar Seller', store: 'Viman Nagar Store', area: 'Viman Nagar', lat: 18.5679, lng: 73.9143, pincode: '411014', city: 'Pune', products: 12, autoApprove: false },
  { phone: '9100000010', owner: 'Baner Seller', store: 'Baner Fresh', area: 'Baner', lat: 18.559, lng: 73.7868, pincode: '411045', city: 'Pune', products: 12, autoApprove: false },
  { phone: '9100000011', owner: 'Hadapsar Seller', store: 'Hadapsar Daily', area: 'Hadapsar', lat: 18.5089, lng: 73.926, pincode: '411028', city: 'Pune', products: 12, autoApprove: false },
  { phone: '9100000012', owner: 'Govandi Seller', store: 'Govandi Grocers', area: 'Govandi', lat: 19.0554, lng: 72.9155, pincode: '400043', city: 'Mumbai', products: 12, autoApprove: false },
  { phone: '9100000013', owner: 'Vashi Seller', store: 'Vashi Bazaar', area: 'Vashi', lat: 19.077, lng: 73.007, pincode: '400703', city: 'Navi Mumbai', products: 12, autoApprove: false },
  { phone: '9100000014', owner: 'Khopoli Seller', store: 'Khopoli Mart', area: 'Khopoli', lat: 18.789, lng: 73.345, pincode: '410203', city: 'Khopoli', products: 12, autoApprove: false },
];

const hours = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open: '09:00', close: '21:00' }));

/**
 * @param {number} index
 * @param {{ rules?: { defaultDelivery?: { express?: boolean } } }} category
 */
function deliveryFor(index, category) {
  const patterns = [
    { express: true, sameDay: false, standard: false },
    { express: false, sameDay: false, standard: true },
    { express: true, sameDay: true, standard: true },
    { express: false, sameDay: true, standard: true },
    { express: true, sameDay: true, standard: false },
  ];
  const mode = { ...patterns[index % patterns.length] };
  if (category.rules?.defaultDelivery?.express === false) mode.express = false;
  if (!mode.express && !mode.sameDay && !mode.standard) mode.standard = true;
  return mode;
}

/**
 * Insert approved sellers, one store each, and about 150 products when missing.
 * Existing seller, store, and product rows are left as edited.
 */
export async function seedCatalog() {
  const categories = await Category.find({ isActive: true }).sort({ sortOrder: 1 }).lean();
  if (categories.length === 0) throw new Error('Seed categories before the catalog');
  const areas = await ServiceArea.find({ isActive: true }).lean();
  const areaByCity = new Map(areas.map((area) => [area.city, area]));

  let productCount = 0;
  for (const [index, place] of places.entries()) {
    const area = areaByCity.get(place.city);
    if (!area) throw new Error(`Missing service area for ${place.city}`);

    let user = await User.findOne({ phone: place.phone });
    if (!user) {
      user = await User.create({
        phone: place.phone,
        name: place.owner,
        roles: ['buyer', 'seller'],
        status: 'active',
      });
    }

    let seller = await Seller.findOne({ userId: user._id });
    if (!seller) {
      const account = `100000000${String(index).padStart(3, '0')}`;
      seller = await Seller.create({
        userId: user._id,
        businessName: place.store,
        type: 'retail_store',
        kyc: {
          pan: 'ABCDE1234F',
          gstin: '',
          fssai: `10000000000${String(index).padStart(3, '0')}`,
          docs: [],
        },
        bank: {
          holderName: place.owner,
          accountNoEnc: encryptString(account),
          accountLast4: account.slice(-4),
          ifsc: 'HDFC0001234',
        },
        status: 'approved',
        commissionPct: null,
        autoApproveProducts: place.autoApprove,
      });
    }

    let store = await Store.findOne({ sellerId: seller._id, name: place.store });
    if (!store) {
      store = await Store.create({
        sellerId: seller._id,
        name: place.store,
        phone: place.phone,
        address: { line1: place.area, line2: '', landmark: '', pincode: place.pincode },
        city: place.city,
        location: { type: 'Point', coordinates: [place.lng, place.lat] },
        serviceAreaId: area._id,
        radiusKm: { express: 5, sameDay: 15, standard: 25 },
        prepTimeMin: 15,
        busyExtraMin: 0,
        hours,
        isOpen: true,
        acceptingOrders: true,
        status: 'active',
      });
    }

    const already = await Product.countDocuments({ storeId: store._id });
    if (already > 0) {
      productCount += already;
      continue;
    }

    const docs = [];
    for (let item = 0; item < place.products; item += 1) {
      const category = categories[item % categories.length];
      const name = `${names[item % names.length]}`;
      const slug = `${slugify(name)}-${item + 1}`;
      const mrpPaise = 4900 + (item % 8) * 1500;
      const food = Boolean(category.rules?.requiresFssai);
      docs.push({
        sellerId: seller._id,
        storeId: store._id,
        categoryId: category._id,
        name,
        slug,
        description: `${name} from ${place.store}`,
        brand: place.store,
        images: [`https://placehold.co/400x400/png?text=${encodeURIComponent(name)}`],
        attributes: {},
        variants: [
          {
            sku: `${slug}-1`.toUpperCase(),
            label: 'Standard',
            mrpPaise,
            pricePaise: mrpPaise - 400,
            stock: item % 7 === 0 ? 0 : item % 7 === 1 ? 3 : 24,
            reservedStock: 0,
            weightGrams: 200 + item * 50,
            barcode: '',
          },
        ],
        gstPct: [0, 5, 12, 18][item % 4],
        hsn: '',
        delivery: deliveryFor(item, category),
        handlingTimeMin: 10 + (item % 3) * 5,
        maxExpressDistanceKm: null,
        flags: {
          fragile: category.slug === 'electronics',
          perishable: food,
          veg: food ? true : null,
        },
        returnWindowDays: food ? 0 : 7,
        approvalStatus: 'approved',
        rejectionReason: '',
        isActive: true,
      });
    }
    await Product.insertMany(docs);
    productCount += docs.length;
  }

  logger.info({ stores: places.length, products: productCount }, 'catalog seed complete');
}
