import "server-only";
/**
 * ENCRYPTION FOR TAX AND BANK DETAILS
 *
 * UTRs, National Insurance numbers, sort codes and account numbers are
 * encrypted on the server with AES-256-GCM BEFORE they are saved, so the
 * database (and its backups) only ever hold scrambled text. Only finance
 * admins can ask the server to decrypt them.
 *
 * Set PAINTER_DATA_ENCRYPTION_KEY to 32 random bytes in base64. Generate one:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 * ⚠️ Keep a copy somewhere safe (e.g. your password manager). If it is lost,
 * stored bank/tax details can't be read and painters must re-enter them.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";

function getKey(): Buffer {
  const raw = process.env.PAINTER_DATA_ENCRYPTION_KEY;
  if (!raw) throw new Error("PAINTER_DATA_ENCRYPTION_KEY is not set – bank and tax details can't be stored");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("PAINTER_DATA_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  return key;
}

export function isEncryptionConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

export function encryptField(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), data.toString("base64")].join(":");
}

export function decryptField(stored: string): string {
  const [version, iv, tag, data] = stored.split(":");
  if (version !== VERSION || !iv || !tag || !data) throw new Error("Unrecognised encrypted value");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

// ----- Format checks (shape only – they don't prove anything to HMRC) -----
export const normalise = (v: string) => v.replace(/[\s-]/g, "").toUpperCase();
export const isUtr = (v: string) => /^\d{10}$/.test(normalise(v));
export const isSortCode = (v: string) => /^\d{6}$/.test(normalise(v));
export const isAccountNumber = (v: string) => /^\d{8}$/.test(normalise(v));
/** National Insurance number shape (HMRC prefix rules simplified). */
export const isNino = (v: string) => /^(?!BG|GB|KN|NK|NT|TN|ZZ)[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]$/.test(normalise(v));
export const lastChars = (v: string, n: number) => normalise(v).slice(-n);
