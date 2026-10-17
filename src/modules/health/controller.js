import { getHealth } from './service.js';
import { sendError, sendOk } from '../../utils/apiResponse.js';

export async function health(_req, res) {
  const report = await getHealth();
  const healthy = report.mongo === 'up' && report.redis === 'up';
  if (!healthy) {
    return sendError(res, {
      status: 503,
      code: 'UNHEALTHY',
      message: 'Dependency check failed',
      details: report,
    });
  }
  return sendOk(res, report);
}
