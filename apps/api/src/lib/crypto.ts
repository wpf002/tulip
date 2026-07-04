import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM for secrets at rest (Plaid access tokens). LOCKED INVARIANT:
 * tokens are never stored plaintext. Format: iv:ciphertext:authTag (hex).
 * Key: 64 hex chars (32 bytes) from TOKEN_ENC_KEY.
 */
function getKey(): Buffer {
  const hex = process.env.TOKEN_ENC_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('TOKEN_ENC_KEY must be set to 64 hex chars (openssl rand -hex 32)');
  }
  return Buffer.from(hex, 'hex');
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${ciphertext.toString('hex')}:${cipher.getAuthTag().toString('hex')}`;
}

export function decryptSecret(stored: string): string {
  const [ivHex, ctHex, tagHex] = stored.split(':');
  if (!ivHex || !ctHex || !tagHex) throw new Error('Malformed encrypted secret');
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(ctHex, 'hex')), decipher.final()]).toString('utf8');
}
