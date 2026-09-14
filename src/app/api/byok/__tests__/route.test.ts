import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptSecret } from "@/lib/security/crypto";

const VALID_TEST_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("BYOK route behavior", () => {
  const previousKey = process.env.BYOK_ENCRYPTION_KEY;

  afterEach(() => {
    if (previousKey === undefined) {
      delete process.env.BYOK_ENCRYPTION_KEY;
    } else {
      process.env.BYOK_ENCRYPTION_KEY = previousKey;
    }
    vi.resetModules();
    vi.doUnmock("@/lib/db/mongodb");
    vi.doUnmock("@/lib/security/identity");
    vi.doUnmock("@/lib/db/models/UserAiConfig");
  });

  it("encrypts credentials before persistence and sanitizes responses", async () => {
    process.env.BYOK_ENCRYPTION_KEY = VALID_TEST_KEY;

    const saved: Array<Record<string, unknown>> = [];
    vi.doMock("@/lib/db/mongodb", () => ({
      connectToDatabase: vi.fn(async () => undefined),
    }));
    vi.doMock("@/lib/security/identity", () => ({
      resolveRequestIdentity: vi.fn(async () => ({
        deviceId: "device-1",
        userId: "user-byok",
      })),
    }));
    vi.doMock("@/lib/db/models/UserAiConfig", () => ({
      UserAiConfig: {
        findOneAndUpdate: vi.fn((_filter: unknown, update: unknown) => {
          const set = (update as { $set: Record<string, unknown> }).$set;
          saved.push(set);
          return {
            lean: async () => ({
              ...set,
              updatedAt: new Date("2026-09-14T00:00:00.000Z"),
            }),
          };
        }),
        findOne: vi.fn(),
        deleteOne: vi.fn(),
      },
    }));

    const { PUT } = await import("@/app/api/byok/route");
    const response = await PUT(
      new Request("http://localhost/api/byok", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "openai",
          selectedModel: "user-selected-model",
          apiKey: "sk-plaintext-secret-value",
        }),
      }),
    );

    const json = (await response.json()) as {
      ok: boolean;
      config: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.config.provider).toBe("openai");
    expect(json.config.selectedModel).toBe("user-selected-model");
    expect(json.config.keyLast4).toBe("alue");
    expect(JSON.stringify(json)).not.toContain("sk-plaintext-secret-value");
    expect(JSON.stringify(json)).not.toContain("encryptedCredential");

    expect(saved).toHaveLength(1);
    const cipher = String(saved[0]?.encryptedCredential);
    expect(cipher).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i);
    expect(cipher).not.toContain("sk-plaintext-secret-value");
    expect(decryptSecret(cipher)).toBe("sk-plaintext-secret-value");
    expect(saved[0]?.disabled).toBe(false);
  });

  it("supports explicit disable without returning secrets", async () => {
    process.env.BYOK_ENCRYPTION_KEY = VALID_TEST_KEY;

    vi.doMock("@/lib/db/mongodb", () => ({
      connectToDatabase: vi.fn(async () => undefined),
    }));
    vi.doMock("@/lib/security/identity", () => ({
      resolveRequestIdentity: vi.fn(async () => ({
        deviceId: "device-1",
        userId: "user-byok",
      })),
    }));
    vi.doMock("@/lib/db/models/UserAiConfig", () => ({
      UserAiConfig: {
        findOneAndUpdate: vi.fn(() => ({
          lean: async () => ({
            provider: "openai",
            selectedModel: "user-selected-model",
            keyLast4: "alue",
            disabled: true,
            updatedAt: new Date("2026-09-14T00:00:00.000Z"),
          }),
        })),
      },
    }));

    const { PUT } = await import("@/app/api/byok/route");
    const response = await PUT(
      new Request("http://localhost/api/byok", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "disable" }),
      }),
    );
    const json = (await response.json()) as {
      ok: boolean;
      config: { disabled: boolean };
    };

    expect(json.ok).toBe(true);
    expect(json.config.disabled).toBe(true);
    expect(JSON.stringify(json)).not.toMatch(/sk-/);
  });
});
