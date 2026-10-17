import { AppError } from '../utils/AppError.js';

/**
 * Allow the request when the signed-in user has at least one of the given roles.
 * @param {...string} roles
 */
export function requireRole(...roles) {
  return (req, _res, next) => {
    const userRoles = req.user?.roles ?? [];
    if (!roles.some((role) => userRoles.includes(role))) {
      next(new AppError('FORBIDDEN', 'You do not have access to this.', 403));
      return;
    }
    next();
  };
}
