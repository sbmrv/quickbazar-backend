import mongoose from 'mongoose';

const ledgerSchema = new mongoose.Schema(
  {
    accountType: { type: String, enum: ['seller', 'rider', 'platform', 'buyer'], required: true },
    accountId: { type: String, required: true },
    direction: { type: String, enum: ['credit', 'debit'], required: true },
    amountPaise: { type: Number, required: true },
    type: { type: String, required: true },
    refType: { type: String, required: true },
    refId: { type: String, required: true },
    note: { type: String, default: '' },
  },
  { timestamps: true },
);
ledgerSchema.index({ refType: 1, refId: 1, type: 1 }, { unique: true });
ledgerSchema.index({ accountType: 1, accountId: 1, createdAt: -1 });

export const LedgerEntry = mongoose.model('LedgerEntry', ledgerSchema);

const payoutSchema = new mongoose.Schema(
  {
    accountType: { type: String, enum: ['seller', 'rider'], required: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, required: true },
    amountPaise: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'approved', 'paid'], default: 'pending' },
    utr: { type: String, default: '' },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
  },
  { timestamps: true },
);

export const Payout = mongoose.model('Payout', payoutSchema);

const remittanceSchema = new mongoose.Schema(
  {
    riderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rider', required: true },
    amountPaise: { type: Number, required: true },
    status: { type: String, default: 'received' },
    receivedBy: { type: String, default: '' },
    note: { type: String, default: '' },
  },
  { timestamps: true },
);

export const CodRemittance = mongoose.model('CodRemittance', remittanceSchema);
