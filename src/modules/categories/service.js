import { AppError } from '../../utils/AppError.js';
import { dropCache, readCache, writeCache } from '../../utils/cache.js';
import { writeAudit } from '../audit/service.js';
import { Category, toPublicCategory } from './model.js';
import { buildCategoryTree, slugify } from './tree.js';

const CACHE_KEY = 'cat:tree';
const CACHE_TTL_SECONDS = 30 * 60;

/**
 * @param {import('mongoose').Types.ObjectId | string | null | undefined} parentId
 * @param {string | null} categoryId
 */
async function assertParent(parentId, categoryId) {
  if (!parentId) return;
  if (categoryId && String(parentId) === String(categoryId)) {
    throw new AppError('PARENT_CYCLE', 'A category cannot be its own parent.', 400);
  }
  let current = parentId;
  while (current) {
    if (categoryId && String(current) === String(categoryId)) {
      throw new AppError('PARENT_CYCLE', 'That parent would create a cycle.', 400);
    }
    const parent = await Category.findById(current).select('parentId').lean();
    if (!parent) throw new AppError('NOT_FOUND', 'Parent category was not found.', 404);
    current = parent.parentId;
  }
}

async function uniqueSlug(name) {
  const base = slugify(name);
  let slug = base;
  let suffix = 2;
  while (await Category.exists({ slug })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

/**
 * Active categories as a tree. Cached for public reads.
 */
export async function listPublicCategories() {
  const cached = await readCache(CACHE_KEY);
  if (cached) return cached;
  const rows = await Category.find({ isActive: true }).lean();
  const tree = buildCategoryTree(rows.map(toPublicCategory));
  await writeCache(CACHE_KEY, tree, CACHE_TTL_SECONDS);
  return tree;
}

/**
 * Full tree, including inactive categories, for admin.
 */
export async function listAdminCategories() {
  const rows = await Category.find().lean();
  return buildCategoryTree(rows.map(toPublicCategory));
}

/**
 * @param {Record<string, unknown>} input
 * @param {{ actorId: string, ip: string }} actor
 */
export async function createCategory(input, actor) {
  await assertParent(input.parentId, null);
  const slug = await uniqueSlug(input.name);
  const created = await Category.create({
    name: input.name,
    slug,
    parentId: input.parentId || null,
    image: input.image || '',
    sortOrder: input.sortOrder,
    isActive: input.isActive,
    rules: input.rules,
  });
  const after = toPublicCategory(created);
  await dropCache([CACHE_KEY]);
  await writeAudit({
    actorId: actor.actorId,
    action: 'category.create',
    entityType: 'Category',
    entityId: after.id,
    before: null,
    after,
    ip: actor.ip,
  });
  return after;
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} input
 * @param {{ actorId: string, ip: string }} actor
 */
export async function updateCategory(id, input, actor) {
  const existing = await Category.findById(id);
  if (!existing) throw new AppError('NOT_FOUND', 'Category was not found.', 404);
  if (input.parentId !== undefined) await assertParent(input.parentId, id);
  const before = toPublicCategory(existing);
  if (input.name !== undefined) existing.name = input.name;
  if (input.parentId !== undefined) existing.parentId = input.parentId || null;
  if (input.image !== undefined) existing.image = input.image || '';
  if (input.sortOrder !== undefined) existing.sortOrder = input.sortOrder;
  if (input.isActive !== undefined) existing.isActive = input.isActive;
  if (input.rules) {
    existing.rules = {
      requiresFssai: input.rules.requiresFssai,
      defaultDelivery: input.rules.defaultDelivery,
    };
  }
  await existing.save();
  const after = toPublicCategory(existing);
  await dropCache([CACHE_KEY]);
  await writeAudit({
    actorId: actor.actorId,
    action: 'category.update',
    entityType: 'Category',
    entityId: after.id,
    before,
    after,
    ip: actor.ip,
  });
  return after;
}

/**
 * @param {string} id
 * @param {{ actorId: string, ip: string }} actor
 */
export async function deleteCategory(id, actor) {
  const existing = await Category.findById(id);
  if (!existing) throw new AppError('NOT_FOUND', 'Category was not found.', 404);
  const child = await Category.exists({ parentId: id });
  if (child) throw new AppError('HAS_CHILDREN', 'Move or delete child categories first.', 409);
  const before = toPublicCategory(existing);
  await existing.deleteOne();
  await dropCache([CACHE_KEY]);
  await writeAudit({
    actorId: actor.actorId,
    action: 'category.delete',
    entityType: 'Category',
    entityId: before.id,
    before,
    after: null,
    ip: actor.ip,
  });
}
