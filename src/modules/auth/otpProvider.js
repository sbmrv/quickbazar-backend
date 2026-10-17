import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { AppError } from '../../utils/AppError.js';

/**
 * Deliver a one-time code. The dev provider writes it to the server log so it can be copied.
 * @param {string} phone
 * @param {string} otp
 */
export async function sendOtp(phone, otp) {
  if (env.OTP_PROVIDER === 'console') {
    logger.info(`Dev OTP for ${phone} is ${otp}`);
    return;
  }
  throw new AppError('OTP_PROVIDER', 'SMS provider is not configured', 500);
}
