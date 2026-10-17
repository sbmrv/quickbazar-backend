import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { env } from '../../config/env.js';
import { getRedis } from '../../config/redis.js';
import { AppError } from '../../utils/AppError.js';
import { User, toPublic } from './model.js';
import { sendOtp } from './otpProvider.js';
import {
  OTP_IP_LIMIT,
  OTP_LIMIT_WINDOW_SECONDS,
  OTP_PHONE_LIMIT,
  evaluateOtpAttempt,
  generateOtpCode,
  hashOtp,
} from './otpLogic.js';
import {
  refreshKey,
  rotateAllowlist,
  signAccessToken,
  signRefreshToken,
  ttlToSeconds,
  verifyRefreshToken,
} from './tokens.js';

/**
 * @param {string} phone
 */
function otpKey(phone) {
  return `otp:${phone}`;
}

function allowlistStore() {
  const redis = getRedis();
  return {
    del: (key) => redis.del(key),
    setEx: (key, ttlSeconds, value) => redis.set(key, value, 'EX', ttlSeconds),
  };
}

/**
 * @param {string} key
 * @param {number} limit
 */
async function bumpLimit(key, limit) {
  const [[, count]] = await getRedis()
    .multi()
    .incr(key)
    .expire(key, OTP_LIMIT_WINDOW_SECONDS, 'NX')
    .exec();
  if (Number(count) > limit) {
    throw new AppError('RATE_LIMITED', 'Too many OTP requests. Try again in a little while.', 429);
  }
}

/**
 * Create a hashed OTP and deliver it. Previous codes for the phone are replaced.
 * @param {{ phone: string, ip: string }} input
 */
export async function requestOtp(input) {
  await bumpLimit(`otp:rl:${input.phone}`, OTP_PHONE_LIMIT);
  await bumpLimit(`otp:rl:ip:${input.ip}`, OTP_IP_LIMIT);
  const code = generateOtpCode();
  const record = JSON.stringify({ hash: hashOtp(code, env.JWT_ACCESS_SECRET), attempts: 0 });
  await getRedis().set(otpKey(input.phone), record, 'EX', env.OTP_TTL_SECONDS);
  await sendOtp(input.phone, code);
  return { sent: true, expiresInSeconds: env.OTP_TTL_SECONDS };
}

/**
 * @param {string} phone
 */
async function findOrCreateBuyer(phone) {
  const existing = await User.findOne({ phone });
  if (existing) return existing;
  try {
    return await User.create({ phone, roles: ['buyer'], status: 'active' });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 11000) {
      const again = await User.findOne({ phone });
      if (again) return again;
    }
    throw err;
  }
}

/**
 * Check a code, then open a session for the matching user.
 * @param {{ phone: string, otp: string }} input
 */
export async function loginWithOtp(input) {
  const key = otpKey(input.phone);
  const redis = getRedis();
  const raw = await redis.get(key);
  const ttl = await redis.ttl(key);
  /** @type {{ hash: string, attempts: number } | null} */
  let state = null;
  if (raw) {
    try {
      state = JSON.parse(raw);
    } catch {
      state = null;
    }
  }

  const outcome = evaluateOtpAttempt(state, input.otp, env.JWT_ACCESS_SECRET);
  if (outcome.result === 'missing') {
    throw new AppError('OTP_EXPIRED', 'That code has expired. Request a new one.', 400);
  }
  if (outcome.result === 'invalid' || (outcome.result === 'locked' && outcome.attempts !== state?.attempts)) {
    const keep = ttl > 0 ? ttl : env.OTP_TTL_SECONDS;
    await redis.set(key, JSON.stringify({ hash: state.hash, attempts: outcome.attempts }), 'EX', keep);
  }
  if (outcome.result === 'locked') {
    throw new AppError('OTP_LOCKED', 'Too many attempts. Request a new code.', 429);
  }
  if (outcome.result === 'invalid') {
    throw new AppError('OTP_INVALID', 'That code is incorrect.', 400);
  }

  await redis.del(key);
  const user = await findOrCreateBuyer(input.phone);
  if (user.status !== 'active') {
    throw new AppError('USER_BLOCKED', 'This account is blocked.', 403);
  }
  user.lastLoginAt = new Date();
  await user.save();
  const tokens = await issueSession(String(user._id));
  return { user: toPublic(user), ...tokens };
}

/**
 * @param {{ email: string, password: string }} input
 */
export async function loginAdmin(input) {
  const user = await User.findOne({ email: input.email }).select('+passwordHash');
  const matches = user?.passwordHash ? await bcrypt.compare(input.password, user.passwordHash) : false;
  if (!user || !user.roles.includes('admin') || !matches) {
    throw new AppError('INVALID_CREDENTIALS', 'Email or password is incorrect.', 401);
  }
  if (user.status !== 'active') {
    throw new AppError('USER_BLOCKED', 'This account is blocked.', 403);
  }
  user.lastLoginAt = new Date();
  await user.save();
  const tokens = await issueSession(String(user._id));
  return { user: toPublic(user), ...tokens };
}

/**
 * Allowlist a new refresh token and sign both cookies' values.
 * @param {string} userId
 */
export async function issueSession(userId) {
  const tokenId = nanoid();
  await getRedis().set(refreshKey(userId, tokenId), '1', 'EX', ttlToSeconds(env.REFRESH_TOKEN_TTL));
  return {
    accessToken: signAccessToken(userId),
    refreshToken: signRefreshToken(userId, tokenId),
  };
}

/**
 * Rotate the refresh token and issue a new access token.
 * @param {string | undefined} refreshToken
 */
export async function refreshSession(refreshToken) {
  if (!refreshToken) throw new AppError('INVALID_REFRESH', 'Sign in again.', 401);
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('INVALID_REFRESH', 'Sign in again.', 401);
  }

  const nextTokenId = nanoid();
  const rotated = await rotateAllowlist(allowlistStore(), {
    userId: payload.sub,
    tokenId: payload.tid,
    nextTokenId,
    ttlSeconds: ttlToSeconds(env.REFRESH_TOKEN_TTL),
  });
  if (!rotated) throw new AppError('INVALID_REFRESH', 'Sign in again.', 401);

  const user = await User.findById(payload.sub);
  if (!user || user.status !== 'active') {
    await getRedis().del(refreshKey(payload.sub, nextTokenId));
    throw new AppError('INVALID_REFRESH', 'Sign in again.', 401);
  }

  return {
    user: toPublic(user),
    accessToken: signAccessToken(String(user._id)),
    refreshToken: signRefreshToken(String(user._id), nextTokenId),
  };
}

/**
 * Remove the presented refresh token from the allowlist.
 * @param {string | undefined} refreshToken
 */
export async function revokeRefresh(refreshToken) {
  if (!refreshToken) return;
  try {
    const payload = verifyRefreshToken(refreshToken);
    await getRedis().del(refreshKey(payload.sub, payload.tid));
  } catch {
    // Expired or malformed cookies are still cleared by the controller.
  }
}

/**
 * Record a seller or rider application. Active roles are unchanged until a later approval step.
 * @param {string} userId
 * @param {'seller' | 'rider'} role
 */
export async function enableRole(userId, role) {
  const user = await User.findById(userId);
  if (!user || user.status !== 'active') {
    throw new AppError('UNAUTHENTICATED', 'Sign in required.', 401);
  }
  if (!user.roles.includes(role) && !user.pendingRoles.includes(role)) {
    user.pendingRoles.push(role);
    await user.save();
  }
  return toPublic(user);
}
