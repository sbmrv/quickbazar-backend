import { AppError } from '../utils/AppError.js';
import { User, toPublic } from '../modules/auth/model.js';
import { ACCESS_COOKIE } from '../modules/auth/cookies.js';
import { verifyAccessToken } from '../modules/auth/tokens.js';

/**
 * Require a valid access-token cookie and an active user.
 * Roles are read from the database so a change applies before the access token expires.
 * @param {import('express').Request} req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 */
export async function requireAuth(req, _res, next) {
  try {
    const token = req.cookies?.[ACCESS_COOKIE];
    if (!token) throw new AppError('UNAUTHENTICATED', 'Sign in required.', 401);
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub).lean();
    if (!user || user.status !== 'active') {
      throw new AppError('UNAUTHENTICATED', 'Sign in required.', 401);
    }
    req.user = toPublic(user);
    next();
  } catch (err) {
    next(err instanceof AppError ? err : new AppError('UNAUTHENTICATED', 'Sign in required.', 401));
  }
}
