import { sendOk } from '../../utils/apiResponse.js';
import { actorFrom } from '../admin/http.js';
import {
  approveProduct,
  createProduct,
  deactivateProduct,
  getOwnProduct,
  listModeration,
  listOwnProducts,
  rejectProduct,
  updateProduct,
  updateStock,
} from './service.js';

export async function listProductsHandler(req, res) {
  const { rows, meta } = await listOwnProducts(req.seller._id, req.validated.query);
  sendOk(res, rows, { meta });
}

export async function getProductHandler(req, res) {
  sendOk(res, await getOwnProduct(req.seller, req.validated.params.id));
}

export async function createProductHandler(req, res) {
  sendOk(res, await createProduct(req.seller, req.validated.body), { status: 201 });
}

export async function updateProductHandler(req, res) {
  sendOk(res, await updateProduct(req.seller, req.validated.params.id, req.validated.body));
}

export async function stockHandler(req, res) {
  sendOk(res, await updateStock(req.seller, req.validated.params.id, req.validated.body));
}

export async function deleteProductHandler(req, res) {
  sendOk(res, await deactivateProduct(req.seller, req.validated.params.id));
}

export async function moderationHandler(req, res) {
  const { rows, meta } = await listModeration(req.validated.query);
  sendOk(res, rows, { meta });
}

export async function approveProductHandler(req, res) {
  sendOk(res, await approveProduct(req.validated.params.id, actorFrom(req)));
}

export async function rejectProductHandler(req, res) {
  sendOk(res, await rejectProduct(req.validated.params.id, req.validated.body.reason, actorFrom(req)));
}
