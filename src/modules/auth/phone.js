/**
 * Normalize an Indian mobile number to 10 digits.
 * @param {string} value
 */
export function normalizePhone(value) {
  const digits = String(value).replace(/[\s-]/g, '');
  if (digits.startsWith('+91') && digits.length === 13) return digits.slice(3);
  if (digits.startsWith('91') && digits.length === 12) return digits.slice(2);
  return digits;
}

export const INDIAN_MOBILE = /^[6-9]\d{9}$/;
