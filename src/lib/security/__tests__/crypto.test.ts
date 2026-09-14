import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/security/crypto";

const VALID_TEST_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("AES-256-GCM crypto", () => {
  const previousKey = process.env.BYOK_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.BYOK_ENCRYPTION_KEY = VALID_TEST_KEY;
  });

  afterEach(() => {
    if (previousKey === undefined) {
      delete process.env.BYOK_ENCRYPTION_KEY;
    } else {
      process.env.BYOK_ENCRYPTION_KEY = previousKey;
    }
  });

  it("round-trips a secret", () => {
    const ciphertext = encryptSecret("super-secret-api-key");
    expect(ciphertext.split(":")).toHaveLength(3);
    expect(decryptSecret(ciphertext)).toBe("super-secret-api-key");
  });

  it("uses a fresh IV so identical secrets produce different ciphertext", () => {
    const first = encryptSecret("same-secret");
    const second = encryptSecret("same-secret");
    expect(first).not.toBe(second);
    expect(decryptSecret(first)).toBe("same-secret");
    expect(decryptSecret(second)).toBe("same-secret");
  });

  it("rejects tampered ciphertext", () => {
    const ciphertext = encryptSecret("tamper-me");
    const [iv, authTag, payload] = ciphertext.split(":");
    const flipped = payload.endsWith("0")
      ? `${payload.slice(0, -1)}1`
      : `${payload.slice(0, -1)}0`;
    const tampered = `${iv}:${authTag}:${flipped}`;

    expect(() => decryptSecret(tampered)).toThrow(
      /authentication failed|corrupted|hexadecimal|format/i,
    );
  });

  it("rejects malformed ciphertext", () => {
    expect(() => decryptSecret("not-valid")).toThrow(/format/i);
    expect(() => decryptSecret("aa:bb")).toThrow(/format/i);
  });

  it("rejects a missing encryption key", () => {
    delete process.env.BYOK_ENCRYPTION_KEY;
    expect(() => encryptSecret("x")).toThrow(/BYOK_ENCRYPTION_KEY/i);
  });

  it("rejects an invalid encryption key without silent repair", () => {
    process.env.BYOK_ENCRYPTION_KEY = "too-short";
    expect(() => encryptSecret("x")).toThrow(/64-character hex/i);

    process.env.BYOK_ENCRYPTION_KEY = "z".repeat(64);
    expect(() => encryptSecret("x")).toThrow(/64-character hex/i);
  });
});
