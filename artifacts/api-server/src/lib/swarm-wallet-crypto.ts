import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * Derive a 32-byte AES key from SESSION_SECRET.
 * Uses a fixed domain separator so the key is isolated from session use.
 */
function masterKey(): Buffer {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) throw new Error("SESSION_SECRET env var is required for swarm key encryption");
  return createHash("sha256").update(secret + ":al0-swarm-keys-v1").digest();
}

/**
 * Encrypt a swarm account mnemonic with AES-256-GCM.
 * Returns a string in the format:  hex(iv):hex(authTag):hex(ciphertext)
 */
export function encryptMnemonic(mnemonic: string): string {
  const key = masterKey();
  const iv  = randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct  = Buffer.concat([cipher.update(mnemonic, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${ct.toString("hex")}`;
}

/**
 * Decrypt a swarm account mnemonic encrypted by encryptMnemonic().
 */
export function decryptMnemonic(encrypted: string): string {
  const key   = masterKey();
  const parts = encrypted.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted mnemonic format");
  const [ivHex, tagHex, ctHex] = parts as [string, string, string];
  const iv     = Buffer.from(ivHex, "hex");
  const tag    = Buffer.from(tagHex, "hex");
  const ct     = Buffer.from(ctHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
