import { sendOk } from '../../utils/apiResponse.js';
import { actorFrom } from '../admin/http.js';
import { createCategory, deleteCategory, listAdminCategories, listPublicCategories, updateCategory } from './service.js';

export async function publicCategories(_req, res) {
  sendOk(res, await listPublicCategories());
}

export async function adminCategories(_req, res) {
  sendOk(res, await listAdminCategories());
}

export async function createCategoryHandler(req, res) {
  const category = await createCategory(req.validated.body, actorFrom(req));
  sendOk(res, category, { status: 201 });
}

export async function updateCategoryHandler(req, res) {
  const category = await updateCategory(req.validated.params.id, req.validated.body, actorFrom(req));
  sendOk(res, category);
}

export async function deleteCategoryHandler(req, res) {
  await deleteCategory(req.validated.params.id, actorFrom(req));
  sendOk(res, { deleted: true });
}
