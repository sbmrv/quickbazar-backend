import mongoose from 'mongoose';

const docSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const sellerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    businessName: { type: String, required: true, trim: true },
    type: { type: String, enum: ['dark_store', 'retail_store', 'individual'], required: true },
    kyc: {
      pan: { type: String, required: true, uppercase: true, trim: true },
      gstin: { type: String, default: '', uppercase: true, trim: true },
      fssai: { type: String, default: '', trim: true },
      docs: { type: [docSchema], default: [] },
    },
    bank: {
      holderName: { type: String, required: true, trim: true },
      accountNoEnc: { type: String, required: true },
      accountLast4: { type: String, required: true },
      ifsc: { type: String, required: true, uppercase: true, trim: true },
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'suspended'],
      default: 'pending',
      index: true,
    },
    rejectionReason: { type: String, default: '' },
    commissionPct: { type: Number, default: null },
    autoApproveProducts: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Seller = mongoose.model('Seller', sellerSchema);

/**
 * Seller fields safe to return to the owner. The account number stays encrypted.
 * @param {Record<string, any>} seller
 */
export function toSellerView(seller) {
  return {
    id: String(seller._id),
    userId: String(seller.userId),
    businessName: seller.businessName,
    type: seller.type,
    kyc: {
      pan: seller.kyc?.pan ?? '',
      gstin: seller.kyc?.gstin ?? '',
      fssai: seller.kyc?.fssai ?? '',
      docs: (seller.kyc?.docs ?? []).map((doc) => ({ label: doc.label, url: doc.url })),
    },
    bank: {
      holderName: seller.bank?.holderName ?? '',
      ifsc: seller.bank?.ifsc ?? '',
      accountLast4: seller.bank?.accountLast4 ?? '',
    },
    status: seller.status,
    rejectionReason: seller.rejectionReason ?? '',
    commissionPct: seller.commissionPct ?? null,
    autoApproveProducts: Boolean(seller.autoApproveProducts),
    createdAt: seller.createdAt,
    updatedAt: seller.updatedAt,
  };
}
