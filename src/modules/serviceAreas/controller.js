import { sendOk } from '../../utils/apiResponse.js';
import { actorFrom } from '../admin/http.js';
import { createServiceArea, deleteServiceArea, listServiceAreas, updateServiceArea } from './service.js';

export async function listServiceAreasHandler(_req, res) {
  sendOk(res, await listServiceAreas());
}

export async function createServiceAreaHandler(req, res) {
  const area = await createServiceArea(req.validated.body, actorFrom(req));
  sendOk(res, area, { status: 201 });
}

export async function updateServiceAreaHandler(req, res) {
  const area = await updateServiceArea(req.validated.params.id, req.validated.body, actorFrom(req));
  sendOk(res, area);
}

export async function deleteServiceAreaHandler(req, res) {
  await deleteServiceArea(req.validated.params.id, actorFrom(req));
  sendOk(res, { deleted: true });
}
