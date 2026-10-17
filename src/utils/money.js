/**
 * Money is integer paise everywhere in the API and database.
 * @param {number} value
 * @returns {number}
 */
export function paise(value) {
  if (!Number.isInteger(value)) {
    throw new TypeError('Money must be integer paise');
  }
  return value;
}
