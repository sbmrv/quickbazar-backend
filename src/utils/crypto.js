import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Encrypt a short secret with AES-256-GCM. The result is `iv.tag.ciphertext` in base64.
 * @param {string} plain
 * @param {string} [keyHex]
 */
export function encryptString(plain, keyHex = env.DATA_ENCRYPTION_KEY) {
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`;
}

/**
 * @param {string} payload
 * @param {string} [keyHex]
 */
export function decryptString(payload, keyHex = env.DATA_ENCRYPTION_KEY) {
  const [ivPart, tagPart, dataPart] = String(payload).split('.');
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error('Invalid ciphertext');
  }
  const key = Buffer.from(keyHex, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivPart, 'base64'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataPart, 'base64')), decipher.final()]).toString('utf8');
}
