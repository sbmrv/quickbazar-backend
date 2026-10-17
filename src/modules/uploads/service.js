import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { nanoid } from 'nanoid';
import { env } from '../../config/env.js';
import { uploadsDir } from '../../config/paths.js';
import { AppError } from '../../utils/AppError.js';
import { writeAudit } from '../audit/service.js';

const extensions = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export function uploadsConfiguredForCloud() {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

/**
 * @param {import('express').Request['file']} file
 * @param {{ actorId: string, ip: string }} actor
 */
export async function storeImage(file, actor) {
  if (!file) throw new AppError('UPLOAD_INVALID', 'Choose an image file.', 400);
  const extension = extensions[file.mimetype];
  if (!extension) throw new AppError('UPLOAD_INVALID', 'Use a JPEG, PNG, or WebP image.', 400);

  let url;
  if (uploadsConfiguredForCloud()) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
    });
    const uploaded = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder: 'quickbazaar' }, (error, result) => {
        if (error || !result) reject(error ?? new Error('Upload failed'));
        else resolve(result);
      });
      stream.end(file.buffer);
    });
    url = uploaded.secure_url;
  } else {
    await mkdir(uploadsDir, { recursive: true });
    const filename = `${nanoid()}${extension}`;
    await writeFile(path.join(uploadsDir, filename), file.buffer);
    url = `/uploads/${filename}`;
  }

  await writeAudit({
    actorId: actor.actorId,
    action: 'upload.create',
    entityType: 'Upload',
    entityId: url,
    before: null,
    after: { url, bytes: file.size, mime: file.mimetype },
    ip: actor.ip,
  });
  return { url };
}
