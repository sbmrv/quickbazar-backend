import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = path.dirname(fileURLToPath(import.meta.url));

/** Local upload directory: server/uploads */
export const uploadsDir = path.resolve(srcDir, '../../uploads');
