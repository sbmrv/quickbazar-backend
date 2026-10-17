/** Stock at or below this count is flagged low, while zero is out of stock. */
export const LOW_STOCK_AT = 5;

/**
 * @param {number} stock
 * @returns {'out' | 'low' | 'ok'}
 */
export function stockLevel(stock) {
  if (stock <= 0) return 'out';
  if (stock <= LOW_STOCK_AT) return 'low';
  return 'ok';
}

/**
 * Trusted sellers skip the moderation queue.
 * @param {boolean} autoApproveProducts
 * @returns {'approved' | 'pending'}
 */
export function approvalForNewProduct(autoApproveProducts) {
  return autoApproveProducts ? 'approved' : 'pending';
}

/**
 * Edits from a normal seller go back through moderation. Stock changes do not.
 * @param {boolean} autoApproveProducts
 */
export function needsRemoderation(autoApproveProducts) {
  return !autoApproveProducts;
}
