import { AppError } from '../../utils/AppError.js';
import { Seller } from './model.js';

/**
 * Attach the signed-in user's seller profile.
 * @param {import('express').Request} req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 */
export async function requireSeller(req, _res, next) {
  try {
    const seller = await Seller.findOne({ userId: req.user.id }).lean();
    if (!seller) {
      throw new AppError('SELLER_REQUIRED', 'Apply to sell before continuing.', 403);
    }
    req.seller = seller;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Catalog changes require an approved seller.
 * @param {import('express').Request} req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 */
export async function requireApprovedSeller(req, _res, next) {
  try {
    if (!req.seller || req.seller.status !== 'approved') {
      throw new AppError('SELLER_NOT_APPROVED', 'Your seller account is not approved yet.', 403);
    }
    next();
  } catch (err) {
    next(err);
  }
}
