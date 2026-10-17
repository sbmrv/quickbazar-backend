import { sendOk } from '../../utils/apiResponse.js';
import { actorFrom } from '../admin/http.js';
import { getAllSettings, updateSetting } from './service.js';
import { settingSchemas } from './validation.js';

export async function listSettingsHandler(_req, res) {
  sendOk(res, await getAllSettings());
}

export async function updateSettingHandler(req, res) {
  const key = req.validated.params.key;
  const parsed = settingSchemas[key].safeParse(req.body);
  if (!parsed.success) {
    throw parsed.error;
  }
  const value = await updateSetting(key, parsed.data, actorFrom(req));
  sendOk(res, value);
}
