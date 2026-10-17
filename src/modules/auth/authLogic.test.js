import { describe, expect, it } from 'vitest';
import { evaluateOtpAttempt, hashOtp } from './otpLogic.js';
import { refreshKey, rotateAllowlist, ttlToSeconds } from './tokens.js';

const secret = 'test-secret-test-secret-test-secret';

function memoryStore() {
  const map = new Map();
  return {
    map,
    async del(key) {
      return map.delete(key) ? 1 : 0;
    },
    async setEx(key, _ttlSeconds, value) {
      map.set(key, value);
    },
  };
}

describe('OTP attempts', () => {
  const hash = hashOtp('123456', secret);

  it('accepts the correct code before the lock', () => {
    expect(evaluateOtpAttempt({ hash, attempts: 4 }, '123456', secret)).toEqual({
      result: 'ok',
      attempts: 4,
    });
  });

  it('locks on the fifth wrong code and rejects the real code after that', () => {
    expect(evaluateOtpAttempt({ hash, attempts: 4 }, '000000', secret)).toEqual({
      result: 'locked',
      attempts: 5,
    });
    expect(evaluateOtpAttempt({ hash, attempts: 5 }, '123456', secret)).toEqual({
      result: 'locked',
      attempts: 5,
    });
  });

  it('counts a wrong code without locking early', () => {
    expect(evaluateOtpAttempt({ hash, attempts: 1 }, '000000', secret)).toEqual({
      result: 'invalid',
      attempts: 2,
    });
  });

  it('does not treat a stored hash as the raw code', () => {
    expect(hash).not.toBe('123456');
    expect(evaluateOtpAttempt(null, '123456', secret)).toEqual({ result: 'missing' });
  });
});

describe('refresh rotation', () => {
  it('converts ttl strings to seconds', () => {
    expect(ttlToSeconds('15m')).toBe(900);
    expect(ttlToSeconds('30d')).toBe(2_592_000);
  });

  it('replaces the allowlisted refresh id and rejects the old one', async () => {
    const store = memoryStore();
    await store.setEx(refreshKey('user-1', 'old'), 10, '1');

    const next = await rotateAllowlist(store, {
      userId: 'user-1',
      tokenId: 'old',
      nextTokenId: 'new',
      ttlSeconds: 10,
    });

    expect(next).toBe('new');
    expect(store.map.has(refreshKey('user-1', 'old'))).toBe(false);
    expect(store.map.get(refreshKey('user-1', 'new'))).toBe('1');

    const reused = await rotateAllowlist(store, {
      userId: 'user-1',
      tokenId: 'old',
      nextTokenId: 'newer',
      ttlSeconds: 10,
    });
    expect(reused).toBeNull();
  });
});
