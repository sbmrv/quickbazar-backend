import { describe, expect, it } from 'vitest';
import { paymentSignature, signaturesMatch, webhookSignature } from './sign.js';

describe('razorpay signatures', () => {
  it('matches a known payment HMAC and rejects a replay with a different signature', () => {
    const secret = 'test_secret_value';
    const good = paymentSignature('order_1', 'pay_1', secret);
    expect(signaturesMatch(good, good)).toBe(true);
    expect(signaturesMatch(good, paymentSignature('order_1', 'pay_2', secret))).toBe(false);
    const body = Buffer.from('{"event":"payment.captured"}');
    const hook = webhookSignature(body, secret);
    expect(signaturesMatch(hook, webhookSignature(body, secret))).toBe(true);
    expect(signaturesMatch(hook, webhookSignature(Buffer.from('{"event":"payment.failed"}'), secret))).toBe(false);
  });
});
