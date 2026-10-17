import { describe, expect, it } from 'vitest';

function net(items, pct) {
  const commission = Math.round((items * pct) / 100);
  return { commission, seller: items - commission };
}

describe('ledger totals', () => {
  it('credits the seller with items minus commission', () => {
    const row = net(100000, 10);
    expect(row.commission + row.seller).toBe(100000);
    expect(row.seller).toBe(90000);
  });
});
