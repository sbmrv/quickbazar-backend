import { sendOk } from '../../utils/apiResponse.js';
import { actorFrom } from '../admin/http.js';
import {
  applyAsSeller,
  approveSeller,
  getOwnProfile,
  getSellerForAdmin,
  listSellers,
  rejectSeller,
  suspendSeller,
  updateOwnProfile,
  updateSellerAdmin,
} from './service.js';

export async function applyHandler(req, res) {
  sendOk(res, await applyAsSeller(req.user.id, req.validated.body), { status: 201 });
}

export async function profileHandler(req, res) {
  sendOk(res, await getOwnProfile(req.user.id));
}

export async function updateProfileHandler(req, res) {
  sendOk(res, await updateOwnProfile(req.user.id, req.validated.body));
}

export async function listSellersHandler(req, res) {
  const { rows, meta } = await listSellers(req.validated.query);
  sendOk(res, rows, { meta });
}

export async function getSellerHandler(req, res) {
  sendOk(res, await getSellerForAdmin(req.validated.params.id));
}

export async function patchSellerHandler(req, res) {
  sendOk(res, await updateSellerAdmin(req.validated.params.id, req.validated.body, actorFrom(req)));
}

export async function approveSellerHandler(req, res) {
  sendOk(res, await approveSeller(req.validated.params.id, req.validated.body, actorFrom(req)));
}

export async function rejectSellerHandler(req, res) {
  sendOk(res, await rejectSeller(req.validated.params.id, req.validated.body.reason, actorFrom(req)));
}

export async function suspendSellerHandler(req, res) {
  sendOk(res, await suspendSeller(req.validated.params.id, req.validated.body.reason, actorFrom(req)));
}
