/**
 * @param {Array<ReturnType<import('./model.js').toPublicCategory>>} rows
 */
export function buildCategoryTree(rows) {
  const nodes = rows.map((row) => ({ ...row, children: [] }));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const roots = [];
  for (const node of nodes) {
    const parent = node.parentId ? byId.get(node.parentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sortList = (list) => {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    for (const node of list) sortList(node.children);
  };
  sortList(roots);
  return roots;
}

/**
 * @param {string} name
 */
export function slugify(name) {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || 'category';
}
