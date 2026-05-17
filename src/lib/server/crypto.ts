import crypto from "node:crypto";

let key: Buffer | null = null;

function getKey() {
  if (key) return key;

  const keyRaw = process.env.APP_ENCRYPTION_KEY;
  if (!keyRaw) {
    throw new Error("APP_ENCRYPTION_KEY is required");
  }

  const parsedKey = Buffer.from(keyRaw, "base64");
  if (parsedKey.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY must be base64 for 32 bytes");
  }

  key = parsedKey;
  return key;
}

export function encryptString(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptString(value: string): string {
  const [ivB64, tagB64, dataB64] = value.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted payload format");
  }
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return plaintext.toString("utf8");
}
