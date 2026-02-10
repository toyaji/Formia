import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

interface EncryptedData {
  encryptedData: string;
  iv: string;
  salt: string;
}

/**
 * Encrypts a string using a secret key (Envelope Encryption style)
 * The 'secret' should be a user-specific value (e.g., derived from their password/session)
 */
export function encrypt(text: string, secret: string): EncryptedData {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = crypto.pbkdf2Sync(secret, salt, ITERATIONS, KEY_LENGTH, 'sha512');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    encryptedData: encrypted + authTag,
    iv: iv.toString('hex'),
    salt: salt.toString('hex'),
  };
}

/**
 * Decrypts a string using a secret key
 */
export function decrypt(encryptedData: string, iv: string, salt: string, secret: string): string {
  const saltBuffer = Buffer.from(salt, 'hex');
  const ivBuffer = Buffer.from(iv, 'hex');
  const key = crypto.pbkdf2Sync(secret, saltBuffer, ITERATIONS, KEY_LENGTH, 'sha512');
  
  // Auth tag is the last 32 chars (16 bytes) of the hex string
  const authTag = Buffer.from(encryptedData.slice(-32), 'hex');
  const cipherText = encryptedData.slice(0, -32);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(cipherText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Masks a secret key for UI display (e.g., sk-...abcd)
 */
export function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  const prefix = key.slice(0, 3);
  const suffix = key.slice(-4);
  return `${prefix}-...${suffix}`;
}
