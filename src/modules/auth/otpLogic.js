import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export const MAX_OTP_ATTEMPTS = 5;
export const OTP_PHONE_LIMIT = 5;
export const OTP_IP_LIMIT = 30;
export const OTP_LIMIT_WINDOW_SECONDS = 60 * 60;

/**
 * @returns {string} Six-digit numeric code.
 */
export function generateOtpCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * @param {string} code
 * @param {string} secret
 */
export function hashOtp(code, secret) {
  return createHmac('sha256', secret).update(code).digest('hex');
}

/**
 * @param {string} code
 * @param {string} hash
 * @param {string} secret
 */
export function otpMatches(code, hash, secret) {
  const actual = Buffer.from(hashOtp(code, secret));
  const expected = Buffer.from(String(hash));
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/**
 * Decide whether this OTP attempt succeeds, fails, or locks the code.
 * A correct code still succeeds when fewer than 5 failures have been recorded.
 * The 5th failure locks the code, including later correct guesses, until a new OTP is requested.
 * @param {{ hash: string, attempts: number } | null} state
 * @param {string} code
 * @param {string} secret
 * @returns {{ result: 'missing' | 'ok' | 'invalid' | 'locked', attempts?: number }}
 */
export function evaluateOtpAttempt(state, code, secret) {
  if (!state?.hash) return { result: 'missing' };
  if (state.attempts >= MAX_OTP_ATTEMPTS) {
    return { result: 'locked', attempts: state.attempts };
  }
  if (otpMatches(code, state.hash, secret)) {
    return { result: 'ok', attempts: state.attempts };
  }
  const attempts = state.attempts + 1;
  if (attempts >= MAX_OTP_ATTEMPTS) return { result: 'locked', attempts };
  return { result: 'invalid', attempts };
}
