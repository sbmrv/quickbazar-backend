import { sendOk } from '../../utils/apiResponse.js';
import { listAuditLogs } from './service.js';

export async function listAuditHandler(req, res) {
  const { rows, meta } = await listAuditLogs(req.validated.query);
  sendOk(res, rows, { meta });
}
