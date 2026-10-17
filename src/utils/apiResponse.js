/**
 * @param {import('express').Response} res
 * @param {unknown} data
 * @param {{ meta?: Record<string, unknown>, status?: number }} [options]
 */
export function sendOk(res, data, options = {}) {
  const body = { success: true, data };
  if (options.meta) body.meta = options.meta;
  return res.status(options.status ?? 200).json(body);
}

/**
 * @param {import('express').Response} res
 * @param {{ code: string, message: string, status?: number, details?: unknown }} error
 */
export function sendError(res, error) {
  const body = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
    },
  };
  if (error.details !== undefined) body.error.details = error.details;
  return res.status(error.status ?? 400).json(body);
}
