import { sendOk } from '../../utils/apiResponse.js';
import { createStore, deactivateStore, listOwnStores, updateStore } from './service.js';

export async function listStoresHandler(req, res) {
  sendOk(res, await listOwnStores(req.seller._id));
}

export async function createStoreHandler(req, res) {
  sendOk(res, await createStore(req.seller, req.validated.body), { status: 201 });
}

export async function updateStoreHandler(req, res) {
  sendOk(res, await updateStore(req.seller, req.validated.params.id, req.validated.body));
}

export async function deleteStoreHandler(req, res) {
  sendOk(res, await deactivateStore(req.seller, req.validated.params.id));
}
