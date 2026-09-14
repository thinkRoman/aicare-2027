import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

/** Presigned upload lifetime (5 minutes). */
export const R2_UPLOAD_TTL_SECONDS = 300;
/** Presigned download lifetime (15 minutes). */
export const R2_DOWNLOAD_TTL_SECONDS = 900;
/**
 * Product default image retention (days) for private R2 objects.
 * Lifecycle enforcement is an ops/bucket rule; application deletion is immediate
 * when an encounter is purged.
 */
export const R2_IMAGE_RETENTION_DAYS = 30;

const ALLOWED_CONTENT_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type AllowedImageContentType = keyof typeof ALLOWED_CONTENT_TYPES;

/**
 * Cloudflare R2 is connected only through the S3-compatible API.
 * Buckets remain private; callers receive short-lived signed URLs only.
 */
export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  /** S3 API endpoint: https://<ACCOUNT_ID>.r2.cloudflarestorage.com */
  endpoint: string;
  /** Cloudflare R2 region is always "auto" unless overridden. */
  region: string;
};

export type R2ClientDependencies = {
  getSignedUrl: typeof getSignedUrl;
  createClient: (config: R2Config) => S3Client;
  sendDelete?: (
    client: S3Client,
    command: DeleteObjectCommand,
  ) => Promise<unknown>;
};

/** @deprecated Use R2ClientDependencies */
export type R2PresignDependencies = R2ClientDependencies;

export function resolveR2Endpoint(
  accountId: string,
  explicitEndpoint?: string,
): string {
  const trimmed = explicitEndpoint?.trim();
  if (trimmed) {
    if (!/^https:\/\//i.test(trimmed)) {
      throw new Error("R2_ENDPOINT must be an https:// S3 API URL");
    }
    if (trimmed.includes("..")) {
      throw new Error("R2_ENDPOINT must not contain path traversal");
    }
    return trimmed.replace(/\/+$/, "");
  }

  if (!accountId.trim()) {
    throw new Error("R2_ACCOUNT_ID is required to resolve the S3 endpoint");
  }

  return `https://${accountId}.r2.cloudflarestorage.com`;
}

/**
 * S3 client for Cloudflare R2.
 * forcePathStyle is required for R2's S3-compatible API.
 */
export function createR2S3Client(config: R2Config): S3Client {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
  });
}

const defaultDependencies: R2PresignDependencies = {
  getSignedUrl,
  createClient: createR2S3Client,
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} is missing or empty`);
  }
  return value.trim();
}

export function loadR2Config(
  env: NodeJS.ProcessEnv = process.env,
): R2Config {
  const accountId = env.R2_ACCOUNT_ID?.trim() ?? "";
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim() ?? "";
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim() ?? "";
  const bucketName = env.R2_BUCKET_NAME?.trim() ?? "";
  const region = env.R2_REGION?.trim() || "auto";

  if (!accountId) {
    throw new Error("R2_ACCOUNT_ID is missing or empty");
  }
  if (!accessKeyId) {
    throw new Error("R2_ACCESS_KEY_ID is missing or empty");
  }
  if (!secretAccessKey) {
    throw new Error("R2_SECRET_ACCESS_KEY is missing or empty");
  }
  if (!bucketName) {
    throw new Error("R2_BUCKET_NAME is missing or empty");
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    endpoint: resolveR2Endpoint(accountId, env.R2_ENDPOINT),
    region,
  };
}

function assertSafeEncounterId(encounterId: string): string {
  if (
    typeof encounterId !== "string" ||
    encounterId.trim() === "" ||
    encounterId.includes("..") ||
    encounterId.includes("/") ||
    encounterId.includes("\\") ||
    !/^[A-Za-z0-9_-]+$/.test(encounterId)
  ) {
    throw new Error(
      "encounterId must be a non-empty alphanumeric token without path separators",
    );
  }
  return encounterId;
}

export function assertAllowedContentType(
  contentType: string,
): asserts contentType is AllowedImageContentType {
  if (!(contentType in ALLOWED_CONTENT_TYPES)) {
    throw new Error(
      `Unsupported content type: ${contentType}. Allowed: ${Object.keys(ALLOWED_CONTENT_TYPES).join(", ")}`,
    );
  }
}

export function extensionForContentType(
  contentType: AllowedImageContentType,
): string {
  return ALLOWED_CONTENT_TYPES[contentType];
}

/**
 * Builds a private encounter-scoped object key.
 * Never returns a public URL.
 */
export function buildEncounterObjectKey(
  encounterId: string,
  contentType: string,
  objectId: string = randomUUID(),
): string {
  const safeEncounterId = assertSafeEncounterId(encounterId);
  assertAllowedContentType(contentType);

  if (
    objectId.includes("..") ||
    objectId.includes("/") ||
    objectId.includes("\\") ||
    !/^[A-Za-z0-9_-]+$/.test(objectId)
  ) {
    throw new Error("objectId must not contain path traversal characters");
  }

  const extension = extensionForContentType(contentType);
  return `encounters/${safeEncounterId}/${objectId}.${extension}`;
}

export function assertPrivateObjectKey(objectKey: string): string {
  if (
    typeof objectKey !== "string" ||
    objectKey.trim() === "" ||
    objectKey.includes("..") ||
    objectKey.startsWith("/") ||
    objectKey.includes("://") ||
    !objectKey.startsWith("encounters/")
  ) {
    throw new Error(
      "objectKey must be a private encounters/... key without traversal or URL schemes",
    );
  }

  const segments = objectKey.split("/");
  if (segments.length !== 3 || segments.some((segment) => segment.length === 0)) {
    throw new Error(
      "objectKey must match encounters/{encounterId}/{uuid}.{extension}",
    );
  }

  return objectKey;
}

export async function generatePresignedUploadUrl(
  params: {
    encounterId: string;
    contentType: string;
    objectId?: string;
  },
  dependencies: R2PresignDependencies = defaultDependencies,
): Promise<{ objectKey: string; uploadUrl: string; expiresInSeconds: number }> {
  const config = loadR2Config();
  assertAllowedContentType(params.contentType);
  const objectKey = buildEncounterObjectKey(
    params.encounterId,
    params.contentType,
    params.objectId,
  );

  const client = dependencies.createClient(config);
  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: objectKey,
    ContentType: params.contentType,
  });

  const uploadUrl = await dependencies.getSignedUrl(client, command, {
    expiresIn: R2_UPLOAD_TTL_SECONDS,
  });

  return {
    objectKey,
    uploadUrl,
    expiresInSeconds: R2_UPLOAD_TTL_SECONDS,
  };
}

export async function generatePresignedDownloadUrl(
  params: { objectKey: string },
  dependencies: R2PresignDependencies = defaultDependencies,
): Promise<{
  objectKey: string;
  downloadUrl: string;
  expiresInSeconds: number;
}> {
  const config = loadR2Config();
  const objectKey = assertPrivateObjectKey(params.objectKey);

  const client = dependencies.createClient(config);
  const command = new GetObjectCommand({
    Bucket: config.bucketName,
    Key: objectKey,
  });

  const downloadUrl = await dependencies.getSignedUrl(client, command, {
    expiresIn: R2_DOWNLOAD_TTL_SECONDS,
  });

  return {
    objectKey,
    downloadUrl,
    expiresInSeconds: R2_DOWNLOAD_TTL_SECONDS,
  };
}

/**
 * Permanently deletes a private R2 object. Never accepts a public URL.
 */
export async function deletePrivateObject(
  params: { objectKey: string },
  dependencies: R2ClientDependencies = defaultDependencies,
): Promise<{ objectKey: string; deleted: true }> {
  const config = loadR2Config();
  const objectKey = assertPrivateObjectKey(params.objectKey);
  const client = dependencies.createClient(config);
  const command = new DeleteObjectCommand({
    Bucket: config.bucketName,
    Key: objectKey,
  });

  if (dependencies.sendDelete) {
    await dependencies.sendDelete(client, command);
  } else {
    await client.send(command);
  }

  return { objectKey, deleted: true };
}

/** Exported for tests that need to assert env loading without network I/O. */
export function requireR2EnvVar(name: string): string {
  return requireEnv(name);
}
