import { beforeEach, describe, expect, it, vi } from "vitest";

describe("upload presign route", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("rejects invalid MIME types", async () => {
    vi.doMock("@/lib/security/identity", () => ({
      resolveRequestIdentity: vi.fn(async () => ({
        deviceId: "device-1",
        userId: null,
      })),
    }));
    vi.doMock("@/lib/db/mongodb", () => ({
      connectToDatabase: vi.fn(async () => undefined),
    }));
    vi.doMock("@/lib/db/models/Encounter", () => ({
      Encounter: {
        findOne: vi.fn(async () => ({
          lean: async () => ({
            encounterId: "enc1",
            deviceId: "device-1",
          }),
        })),
      },
    }));

    const { POST } = await import("@/app/api/upload/presign/route");
    const response = await POST(
      new Request("http://localhost/api/upload/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          encounterId: "enc1",
          contentType: "application/pdf",
        }),
      }),
    );

    expect(response.status).toBe(400);
    const json = (await response.json()) as { ok: boolean; message: string };
    expect(json.ok).toBe(false);
    expect(json.message).toMatch(/Unsupported content type/i);
  });

  it("rejects unauthorized encounters", async () => {
    vi.doMock("@/lib/security/identity", () => ({
      resolveRequestIdentity: vi.fn(async () => ({
        deviceId: "device-other",
        userId: null,
      })),
    }));
    vi.doMock("@/lib/db/mongodb", () => ({
      connectToDatabase: vi.fn(async () => undefined),
    }));
    vi.doMock("@/lib/db/models/Encounter", () => ({
      Encounter: {
        findOne: vi.fn(() => ({
          lean: async () => ({
            encounterId: "enc1",
            deviceId: "device-1",
          }),
        })),
      },
    }));

    const { POST } = await import("@/app/api/upload/presign/route");
    const response = await POST(
      new Request("http://localhost/api/upload/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          encounterId: "enc1",
          contentType: "image/jpeg",
        }),
      }),
    );

    expect(response.status).toBe(403);
  });

  it("returns a private encounter-scoped presign with 300s expiry", async () => {
    vi.doMock("@/lib/security/identity", () => ({
      resolveRequestIdentity: vi.fn(async () => ({
        deviceId: "device-1",
        userId: null,
      })),
    }));
    vi.doMock("@/lib/db/mongodb", () => ({
      connectToDatabase: vi.fn(async () => undefined),
    }));
    vi.doMock("@/lib/db/models/Encounter", () => ({
      Encounter: {
        findOne: vi.fn(() => ({
          lean: async () => ({
            encounterId: "enc1",
            deviceId: "device-1",
          }),
        })),
      },
    }));
    vi.doMock("@/lib/storage/r2", async () => {
      const actual = await vi.importActual<typeof import("@/lib/storage/r2")>(
        "@/lib/storage/r2",
      );
      return {
        ...actual,
        generatePresignedUploadUrl: vi.fn(async () => ({
          objectKey: "encounters/enc1/obj.jpg",
          uploadUrl: "https://r2.example/presigned",
          expiresInSeconds: 300,
        })),
      };
    });

    const { POST } = await import("@/app/api/upload/presign/route");
    const response = await POST(
      new Request("http://localhost/api/upload/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          encounterId: "enc1",
          contentType: "image/jpeg",
        }),
      }),
    );

    const json = (await response.json()) as {
      ok: boolean;
      objectKey: string;
      expiresInSeconds: number;
      uploadUrl: string;
    };
    expect(json.ok).toBe(true);
    expect(json.objectKey).toBe("encounters/enc1/obj.jpg");
    expect(json.expiresInSeconds).toBe(300);
    expect(json.uploadUrl).not.toMatch(/public/i);
  });
});
