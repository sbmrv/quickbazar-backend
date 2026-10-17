import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';
import { sendError } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';
import { reportError } from '../utils/reportError.js';
import { env } from '../config/env.js';

/**
 * Express 5 error middleware. Async route errors land here.
 * @param {unknown} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    return sendError(res, {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: err.issues[0]?.message || 'Invalid request',
      details: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  if (err instanceof AppError) {
    if (err.status >= 500) logger.error({ err, path: req.path }, err.message);
    return sendError(res, {
      status: err.status,
      code: err.code,
      message: err.message,
      details: err.details,
    });
  }

  reportError(err, { path: req.path });
  return sendError(res, {
    status: 500,
    code: 'INTERNAL',
    message: env.NODE_ENV === 'production' ? 'Something went wrong' : 'Internal server error',
  });
}

/**
 * @param {import('express').Request} _req
 * @param {import('express').Response} res
 */
export function notFoundHandler(_req, res) {
  return sendError(res, {
    status: 404,
    code: 'NOT_FOUND',
    message: 'Route not found',
  });
}
