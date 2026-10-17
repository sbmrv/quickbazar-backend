import Razorpay from 'razorpay';
import { env } from './env.js';

/**
 * Razorpay SDK, or null when test keys are not in the environment.
 */
export function razorpayClient() {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) return null;
  return new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
}

/**
 * Public key id the browser Checkout script is allowed to see.
 */
export function razorpayKeyId() {
  return env.RAZORPAY_KEY_ID ?? '';
}
