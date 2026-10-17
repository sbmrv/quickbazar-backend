import { describe, expect, it } from 'vitest';
import { approvalForNewProduct, needsRemoderation, stockLevel } from './rules.js';

describe('catalog rules', () => {
  it('flags low and empty stock', () => {
    expect(stockLevel(0)).toBe('out');
    expect(stockLevel(5)).toBe('low');
    expect(stockLevel(6)).toBe('ok');
  });

  it('auto-approves only trusted sellers', () => {
    expect(approvalForNewProduct(true)).toBe('approved');
    expect(approvalForNewProduct(false)).toBe('pending');
    expect(needsRemoderation(false)).toBe(true);
    expect(needsRemoderation(true)).toBe(false);
  });
});
