import { AppError } from '../../utils/AppError.js';
import { decryptString, encryptString } from '../../utils/crypto.js';
import { User } from '../auth/model.js';
import { writeAudit } from '../audit/service.js';
import { Product } from '../products/model.js';
import { Store } from '../stores/model.js';
import { Seller, toSellerView } from './model.js';

/**
 * @param {string} accountNo
 */
function sealAccount(accountNo) {
  return {
    accountNoEnc: encryptString(accountNo),
    accountLast4: accountNo.slice(-4),
  };
}

/**
 * @param {Record<string, any>} seller
 */
function adminSellerView(seller) {
  let accountNo = '';
  try {
    accountNo = decryptString(seller.bank.accountNoEnc);
  } catch {
    accountNo = '';
  }
  return { ...toSellerView(seller), bank: { ...toSellerView(seller).bank, accountNo } };
}

/**
 * @param {string} userId
 * @param {{ businessName: string, type: string, kyc: { pan: string, gstin?: string, fssai?: string, docs?: { label: string, url: string }[] }, bank: { holderName: string, accountNo: string, ifsc: string } }} body
 */
export async function applyAsSeller(userId, body) {
  const existing = await Seller.findOne({ userId });
  if (existing && (existing.status === 'approved' || existing.status === 'suspended')) {
    throw new AppError('SELLER_EXISTS', 'This account already has a seller profile.', 409);
  }

  const sealed = sealAccount(body.bank.accountNo);
  const fields = {
    businessName: body.businessName,
    type: body.type,
    kyc: {
      pan: body.kyc.pan,
      gstin: body.kyc.gstin ?? '',
      fssai: body.kyc.fssai ?? '',
      docs: body.kyc.docs ?? [],
    },
    bank: {
      holderName: body.bank.holderName,
      ifsc: body.bank.ifsc,
      ...sealed,
    },
    status: 'pending',
    rejectionReason: '',
  };

  const seller = existing
    ? await Seller.findByIdAndUpdate(existing._id, fields, { new: true }).lean()
    : await Seller.create({ userId, ...fields, commissionPct: null, autoApproveProducts: false });

  await User.updateOne({ _id: userId }, { $addToSet: { pendingRoles: 'seller' } });
  return toSellerView(seller);
}

/**
 * @param {string} userId
 */
export async function getOwnProfile(userId) {
  const seller = await Seller.findOne({ userId }).lean();
  if (!seller) throw new AppError('SELLER_REQUIRED', 'Apply to sell before continuing.', 404);
  return toSellerView(seller);
}

/**
 * @param {string} userId
 * @param {{ businessName: string, type: string, kyc: { pan: string, gstin?: string, fssai?: string, docs?: { label: string, url: string }[] }, bank: { holderName: string, accountNo?: string, ifsc: string } }} body
 */
export async function updateOwnProfile(userId, body) {
  const seller = await Seller.findOne({ userId });
  if (!seller) throw new AppError('SELLER_REQUIRED', 'Apply to sell before continuing.', 404);
  if (seller.status === 'suspended') {
    throw new AppError('SELLER_SUSPENDED', 'This seller account is suspended.', 403);
  }

  seller.businessName = body.businessName;
  seller.type = body.type;
  seller.kyc = {
    pan: body.kyc.pan,
    gstin: body.kyc.gstin ?? '',
    fssai: body.kyc.fssai ?? '',
    docs: body.kyc.docs ?? [],
  };
  seller.bank.holderName = body.bank.holderName;
  seller.bank.ifsc = body.bank.ifsc;
  if (body.bank.accountNo) {
    const sealed = sealAccount(body.bank.accountNo);
    seller.bank.accountNoEnc = sealed.accountNoEnc;
    seller.bank.accountLast4 = sealed.accountLast4;
  }
  if (seller.status === 'rejected') {
    seller.status = 'pending';
    seller.rejectionReason = '';
    await User.updateOne({ _id: userId }, { $addToSet: { pendingRoles: 'seller' } });
  }
  await seller.save();
  return toSellerView(seller);
}

/**
 * @param {{ status?: string, page: number, limit: number }} query
 */
export async function listSellers(query) {
  const filter = query.status ? { status: query.status } : {};
  const skip = (query.page - 1) * query.limit;
  const [rows, total] = await Promise.all([
    Seller.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit).lean(),
    Seller.countDocuments(filter),
  ]);
  const users = await User.find({ _id: { $in: rows.map((row) => row.userId) } })
    .select('phone name')
    .lean();
  const byId = new Map(users.map((user) => [String(user._id), user]));
  return {
    rows: rows.map((row) => {
      const user = byId.get(String(row.userId));
      return {
        ...toSellerView(row),
        user: { name: user?.name ?? '', phone: user?.phone ?? null },
      };
    }),
    meta: { page: query.page, limit: query.limit, total },
  };
}

/**
 * @param {string} id
 */
export async function getSellerForAdmin(id) {
  const seller = await Seller.findById(id).lean();
  if (!seller) throw new AppError('NOT_FOUND', 'Seller not found.', 404);
  const [user, stores, counts] = await Promise.all([
    User.findById(seller.userId).select('phone name').lean(),
    Store.find({ sellerId: seller._id }).select('name city status isOpen').lean(),
    Product.aggregate([
      { $match: { sellerId: seller._id } },
      { $group: { _id: '$approvalStatus', count: { $sum: 1 } } },
    ]),
  ]);
  const products = { pending: 0, approved: 0, rejected: 0 };
  for (const row of counts) products[row._id] = row.count;
  return {
    ...adminSellerView(seller),
    user: { name: user?.name ?? '', phone: user?.phone ?? null },
    stores: stores.map((store) => ({
      id: String(store._id),
      name: store.name,
      city: store.city,
      status: store.status,
      isOpen: store.isOpen,
    })),
    products,
  };
}

/**
 * @param {import('mongoose').Document} seller
 * @param {{ commissionPct?: number | null, autoApproveProducts?: boolean }} body
 */
function applyAdminFields(seller, body) {
  if (body.commissionPct !== undefined) seller.commissionPct = body.commissionPct;
  if (body.autoApproveProducts !== undefined) seller.autoApproveProducts = body.autoApproveProducts;
}

/**
 * @param {string} id
 * @param {{ commissionPct?: number | null, autoApproveProducts?: boolean }} body
 * @param {{ actorId: string, ip: string }} actor
 */
export async function updateSellerAdmin(id, body, actor) {
  const seller = await Seller.findById(id);
  if (!seller) throw new AppError('NOT_FOUND', 'Seller not found.', 404);
  const before = toSellerView(seller);
  applyAdminFields(seller, body);
  await seller.save();
  const after = toSellerView(seller);
  await writeAudit({
    actorId: actor.actorId,
    action: 'seller.update',
    entityType: 'Seller',
    entityId: String(seller._id),
    before,
    after,
    ip: actor.ip,
  });
  return after;
}

/**
 * @param {string} id
 * @param {{ commissionPct?: number | null, autoApproveProducts?: boolean }} body
 * @param {{ actorId: string, ip: string }} actor
 */
export async function approveSeller(id, body, actor) {
  const seller = await Seller.findById(id);
  if (!seller) throw new AppError('NOT_FOUND', 'Seller not found.', 404);
  const before = toSellerView(seller);
  applyAdminFields(seller, body);
  seller.status = 'approved';
  seller.rejectionReason = '';
  await seller.save();
  await User.updateOne(
    { _id: seller.userId },
    { $addToSet: { roles: 'seller' }, $pull: { pendingRoles: 'seller' } },
  );
  const after = toSellerView(seller);
  await writeAudit({
    actorId: actor.actorId,
    action: 'seller.approve',
    entityType: 'Seller',
    entityId: String(seller._id),
    before,
    after,
    ip: actor.ip,
  });
  return after;
}

/**
 * @param {string} id
 * @param {string} reason
 * @param {{ actorId: string, ip: string }} actor
 */
export async function rejectSeller(id, reason, actor) {
  const seller = await Seller.findById(id);
  if (!seller) throw new AppError('NOT_FOUND', 'Seller not found.', 404);
  if (seller.status !== 'pending') {
    throw new AppError('SELLER_STATE', 'Only a pending application can be rejected.', 409);
  }
  const before = toSellerView(seller);
  seller.status = 'rejected';
  seller.rejectionReason = reason;
  await seller.save();
  await User.updateOne({ _id: seller.userId }, { $pull: { pendingRoles: 'seller' } });
  const after = toSellerView(seller);
  await writeAudit({
    actorId: actor.actorId,
    action: 'seller.reject',
    entityType: 'Seller',
    entityId: String(seller._id),
    before,
    after,
    ip: actor.ip,
  });
  return after;
}

/**
 * @param {string} id
 * @param {string} reason
 * @param {{ actorId: string, ip: string }} actor
 */
export async function suspendSeller(id, reason, actor) {
  const seller = await Seller.findById(id);
  if (!seller) throw new AppError('NOT_FOUND', 'Seller not found.', 404);
  if (seller.status !== 'approved') {
    throw new AppError('SELLER_STATE', 'Only an approved seller can be suspended.', 409);
  }
  const before = toSellerView(seller);
  seller.status = 'suspended';
  seller.rejectionReason = reason;
  await seller.save();
  await User.updateOne({ _id: seller.userId }, { $pull: { roles: 'seller' } });
  const after = toSellerView(seller);
  await writeAudit({
    actorId: actor.actorId,
    action: 'seller.suspend',
    entityType: 'Seller',
    entityId: String(seller._id),
    before,
    after,
    ip: actor.ip,
  });
  return after;
}
