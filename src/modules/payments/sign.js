import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * HMAC of `orderId|paymentId` using the Razorpay key secret.
 * @param {string} orderId
 * @param {string} paymentId
 * @param {string} secret
 */
export function paymentSignature(orderId, paymentId, secret) {
  return createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
}

/**
 * HMAC of the raw webhook body using the webhook secret.
 * @param {Buffer | string} rawBody
 * @param {string} secret
 */
export function webhookSignature(rawBody, secret) {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

/**
 * Constant-time compare of two hex signatures.
 * @param {string} expected
 * @param {string} received
 */
export function signaturesMatch(expected, received) {
  if (!expected || !received) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
