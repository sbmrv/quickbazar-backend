import { env } from '../../config/env.js';
import { ttlToSeconds } from './tokens.js';

export const ACCESS_COOKIE = 'qb_access';
export const REFRESH_COOKIE = 'qb_refresh';

function baseOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
  };
}

/**
 * @param {import('express').Response} res
 * @param {{ accessToken: string, refreshToken: string }} tokens
 */
export function setAuthCookies(res, tokens) {
  const base = baseOptions();
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...base,
    path: '/',
    maxAge: ttlToSeconds(env.ACCESS_TOKEN_TTL) * 1000,
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...base,
    path: '/api/v1/auth',
    maxAge: ttlToSeconds(env.REFRESH_TOKEN_TTL) * 1000,
  });
}

/**
 * @param {import('express').Response} res
 */
export function clearAuthCookies(res) {
  const base = baseOptions();
  res.clearCookie(ACCESS_COOKIE, { ...base, path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...base, path: '/api/v1/auth' });
}
