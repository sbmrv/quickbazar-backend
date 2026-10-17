import { logger } from './logger.js';

/**
 * Structured error hook. Set SENTRY_DSN later to forward these; the package stays optional.
 * @param {unknown} err
 * @param {Record<string, unknown>} [extra]
 */
export function reportError(err, extra = {}) {
  logger.error({ err, ...extra }, 'reported error');
}
