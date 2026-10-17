import { describe, expect, it } from 'vitest';
import { decryptString, encryptString } from './crypto.js';

const key = 'ab'.repeat(32);

describe('encryptString', () => {
  it('round-trips a bank account and hides the plaintext', () => {
    const account = '123456789012';
    const hidden = encryptString(account, key);
    expect(hidden).not.toContain(account);
    expect(decryptString(hidden, key)).toBe(account);
    expect(encryptString(account, key)).not.toBe(hidden);
  });
});
