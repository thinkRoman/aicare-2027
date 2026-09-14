import { S3Client } from "@aws-sdk/client-s3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  R2_DOWNLOAD_TTL_SECONDS,
  R2_UPLOAD_TTL_SECONDS,
  assertPrivateObjectKey,
  buildEncounterObjectKey,
  createR2S3Client,
  generatePresignedDownloadUrl,
  generatePresignedUploadUrl,
  loadR2Config,
  resolveR2Endpoint,
} from "@/lib/storage/r2";

describe("Cloudflare R2 via S3 API", () => {
  const previousEnv = {
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
    R2_ENDPOINT: process.env.R2_ENDPOINT,
    R2_REGION: process.env.R2_REGION,
  };

  beforeEach(() => {
    process.env.R2_ACCOUNT_ID = "test-account";
    process.env.R2_ACCESS_KEY_ID = "test-access-key";
    process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
    process.env.R2_BUCKET_NAME = "aicare";
    delete process.env.R2_ENDPOINT;
    process.env.R2_REGION = "auto";
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("loads R2 S3 API configuration from the environment", () => {
    expect(loadR2Config()).toEqual({
      accountId: "test-account",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
      bucketName: "aicare",
      endpoint: "https://test-account.r2.cloudflarestorage.com",
      region: "auto",
    });
  });

  it("prefers an explicit R2_ENDPOINT for the S3 API", () => {
    process.env.R2_ENDPOINT =
      "https://test-account.r2.cloudflarestorage.com";
    const config = loadR2Config();
    expect(config.endpoint).toBe(
      "https://test-account.r2.cloudflarestorage.com",
    );
    expect(config.region).toBe("auto");
  });

  it("resolves the default Cloudflare R2 S3 endpoint from account id", () => {
    expect(resolveR2Endpoint("abc123")).toBe(
      "https://abc123.r2.cloudflarestorage.com",
    );
  });

  it("rejects non-HTTPS R2 endpoints", () => {
    expect(() =>
      resolveR2Endpoint("abc", "http://insecure.example.com"),
    ).toThrow(/https:\/\//i);
  });

  it("creates an S3 client for R2", () => {
    const client = createR2S3Client(loadR2Config());
    expect(client).toBeInstanceOf(S3Client);
  });

  it("builds safe encounter-scoped object keys", () => {
    const key = buildEncounterObjectKey(
      "enc123",
      "image/jpeg",
      "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    );
    expect(key).toBe(
      "encounters/enc123/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg",
    );
    expect(key).not.toContain("://");
  });

  it("prevents path traversal in object key generation", () => {
    expect(() =>
      buildEncounterObjectKey("../etc", "image/png", "obj1"),
    ).toThrow(/path separators|alphanumeric/i);

    expect(() =>
      buildEncounterObjectKey("enc1", "image/png", "../escape"),
    ).toThrow(/path traversal/i);

    expect(() => assertPrivateObjectKey("encounters/../secret.jpg")).toThrow(
      /traversal|objectKey/i,
    );
    expect(() =>
      assertPrivateObjectKey("https://example.com/public.jpg"),
    ).toThrow(/private|URL/i);
  });

  it("rejects unsupported content types", () => {
    expect(() => buildEncounterObjectKey("enc1", "application/pdf")).toThrow(
      /Unsupported content type/i,
    );
  });

  it("presigns uploads with 300s TTL via injected dependencies (no network)", async () => {
    const getSignedUrl = vi.fn(async () => "https://r2.example/presigned-upload");
    const createClient = vi.fn(() => ({}) as S3Client);

    const result = await generatePresignedUploadUrl(
      {
        encounterId: "enc42",
        contentType: "image/webp",
        objectId: "obj42",
      },
      { getSignedUrl, createClient },
    );

    expect(result.objectKey).toBe("encounters/enc42/obj42.webp");
    expect(result.uploadUrl).toBe("https://r2.example/presigned-upload");
    expect(result.expiresInSeconds).toBe(R2_UPLOAD_TTL_SECONDS);
    expect(R2_UPLOAD_TTL_SECONDS).toBe(300);
    expect(createClient).toHaveBeenCalledOnce();
    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "https://test-account.r2.cloudflarestorage.com",
        region: "auto",
        bucketName: "aicare",
      }),
    );
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 300 },
    );
  });

  it("presigns downloads with 900s TTL via injected dependencies (no network)", async () => {
    const getSignedUrl = vi.fn(
      async () => "https://r2.example/presigned-download",
    );
    const createClient = vi.fn(() => ({}) as S3Client);

    const result = await generatePresignedDownloadUrl(
      { objectKey: "encounters/enc42/obj42.webp" },
      { getSignedUrl, createClient },
    );

    expect(result.downloadUrl).toBe("https://r2.example/presigned-download");
    expect(result.expiresInSeconds).toBe(R2_DOWNLOAD_TTL_SECONDS);
    expect(R2_DOWNLOAD_TTL_SECONDS).toBe(900);
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 900 },
    );
  });
});
