import { sendOk } from '../../utils/apiResponse.js';
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from './cookies.js';
import { enableRole, loginAdmin, loginWithOtp, refreshSession, requestOtp, revokeRefresh } from './service.js';

/**
 * @param {import('express').Request} req
 */
function clientIp(req) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  return ip.replace(/^::ffff:/, '');
}

export async function requestOtpHandler(req, res) {
  const data = await requestOtp({ phone: req.validated.body.phone, ip: clientIp(req) });
  sendOk(res, data);
}

export async function verifyOtpHandler(req, res) {
  const { user, accessToken, refreshToken } = await loginWithOtp(req.validated.body);
  setAuthCookies(res, { accessToken, refreshToken });
  sendOk(res, { user });
}

export async function adminLoginHandler(req, res) {
  const { user, accessToken, refreshToken } = await loginAdmin(req.validated.body);
  setAuthCookies(res, { accessToken, refreshToken });
  sendOk(res, { user });
}

export async function refreshHandler(req, res) {
  const { user, accessToken, refreshToken } = await refreshSession(req.cookies?.[REFRESH_COOKIE]);
  setAuthCookies(res, { accessToken, refreshToken });
  sendOk(res, { user });
}

export async function logoutHandler(req, res) {
  await revokeRefresh(req.cookies?.[REFRESH_COOKIE]);
  clearAuthCookies(res);
  sendOk(res, { loggedOut: true });
}

export async function meHandler(req, res) {
  sendOk(res, req.user);
}

export async function enableRoleHandler(req, res) {
  const user = await enableRole(req.user.id, req.validated.params.role);
  sendOk(res, user);
}
