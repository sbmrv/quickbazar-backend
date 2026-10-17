import { sendOk } from '../../utils/apiResponse.js';
import { actorFrom } from '../admin/http.js';
import { storeImage } from './service.js';

export async function uploadImageHandler(req, res) {
  const stored = await storeImage(req.file, actorFrom(req));
  sendOk(res, stored, { status: 201 });
}
