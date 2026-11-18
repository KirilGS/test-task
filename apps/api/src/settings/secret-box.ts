import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;

export type SealedBox = {
  salt: string;
  iv: string;
  tag: string;
  data: string;
};

export function sealText(plain: string, secret: string): SealedBox {
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(secret, salt);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return {
    salt: salt.toString("base64url"),
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    data: data.toString("base64url"),
  };
}

export function openText(sealed: SealedBox, secret: string): string | null {
  const salt = readPart(sealed.salt);
  const iv = readPart(sealed.iv);
  const tag = readPart(sealed.tag);
  const data = readPart(sealed.data);
  if (salt === null || iv === null || tag === null || data === null) {
    return null;
  }
  if (iv.length !== IV_LENGTH || tag.length !== 16) {
    return null;
  }

  try {
    const decipher = createDecipheriv("aes-256-gcm", deriveKey(secret, salt), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

function deriveKey(secret: string, salt: Buffer): Buffer {
  return scryptSync(secret, salt, KEY_LENGTH, { N: 16384, r: 8, p: 1 });
}

function readPart(value: string): Buffer | null {
  if (value.length === 0) {
    return null;
  }
  try {
    const decoded = Buffer.from(value, "base64url");
    if (decoded.length === 0) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}
