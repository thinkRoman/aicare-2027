import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const KEY_LENGTH_BYTES = 32;
const HEX_KEY_LENGTH = KEY_LENGTH_BYTES * 2;

function resolveEncryptionKey(): Buffer {
  const raw = process.env.BYOK_ENCRYPTION_KEY;
  if (raw === undefined || raw.trim() === "") {
    throw new Error("BYOK_ENCRYPTION_KEY is missing or empty");
  }

  const normalized = raw.trim();
  if (!/^[0-9a-fA-F]+$/.test(normalized) || normalized.length !== HEX_KEY_LENGTH) {
    throw new Error(
      `BYOK_ENCRYPTION_KEY must be a ${HEX_KEY_LENGTH}-character hex string (${KEY_LENGTH_BYTES} bytes)`,
    );
  }

  const key = Buffer.from(normalized, "hex");
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `BYOK_ENCRYPTION_KEY must decode to exactly ${KEY_LENGTH_BYTES} bytes`,
    );
  }

  return key;
}

function assertNonEmptySecret(secret: string): void {
  if (typeof secret !== "string" || secret.length === 0) {
    throw new Error("Secret to encrypt must be a non-empty string");
  }
}

function parseCiphertext(ciphertext: string): {
  iv: Buffer;
  authTag: Buffer;
  encryptedPayload: Buffer;
} {
  if (typeof ciphertext !== "string" || ciphertext.trim() === "") {
    throw new Error("Ciphertext is missing or empty");
  }

  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error(
      "Ciphertext must use format iv:authTag:encryptedPayload (hex)",
    );
  }

  const [ivHex, authTagHex, payloadHex] = parts;
  if (
    !/^[0-9a-fA-F]+$/.test(ivHex) ||
    !/^[0-9a-fA-F]+$/.test(authTagHex) ||
    !/^[0-9a-fA-F]+$/.test(payloadHex)
  ) {
    throw new Error("Ciphertext components must be hexadecimal");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encryptedPayload = Buffer.from(payloadHex, "hex");

  if (iv.length !== IV_LENGTH_BYTES) {
    throw new Error(`IV must be ${IV_LENGTH_BYTES} bytes`);
  }
  if (authTag.length !== AUTH_TAG_LENGTH_BYTES) {
    throw new Error(`Authentication tag must be ${AUTH_TAG_LENGTH_BYTES} bytes`);
  }
  if (encryptedPayload.length === 0) {
    throw new Error("Encrypted payload is empty");
  }

  return { iv, authTag, encryptedPayload };
}

/**
 * Encrypts a secret with AES-256-GCM.
 * Output format: iv:authTag:encryptedPayload (each component hex-encoded).
 * Never log plaintext or ciphertext contents in application code.
 */
export function encryptSecret(secret: string): string {
  assertNonEmptySecret(secret);
  const key = resolveEncryptionKey();
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });
  const encryptedPayload = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encryptedPayload.toString("hex")}`;
}

/**
 * Decrypts a ciphertext produced by encryptSecret.
 * Rejects malformed or tampered input via GCM auth-tag verification.
 */
export function decryptSecret(ciphertext: string): string {
  const key = resolveEncryptionKey();
  const { iv, authTag, encryptedPayload } = parseCiphertext(ciphertext);
  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(encryptedPayload),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    throw new Error("Ciphertext authentication failed or payload is corrupted");
  }
}
