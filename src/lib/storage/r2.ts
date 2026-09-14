import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

export const R2_UPLOAD_TTL_SECONDS = 300;
export const R2_DOWNLOAD_TTL_SECONDS = 900;

const ALLOWED_CONTENT_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type AllowedImageContentType = keyof typeof ALLOWED_CONTENT_TYPES;

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
};

export type R2PresignDependencies = {
  getSignedUrl: typeof getSignedUrl;
  createClient: (config: R2Config) => S3Client;
};

const defaultDependencies: R2PresignDependencies = {
  getSignedUrl,
  createClient(config: R2Config): S3Client {
    return new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  },
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
  const accountId = env.R2_ACCOUNT_ID;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const bucketName = env.R2_BUCKET_NAME;

  if (!accountId?.trim()) {
    throw new Error("R2_ACCOUNT_ID is missing or empty");
  }
  if (!accessKeyId?.trim()) {
    throw new Error("R2_ACCESS_KEY_ID is missing or empty");
  }
  if (!secretAccessKey?.trim()) {
    throw new Error("R2_SECRET_ACCESS_KEY is missing or empty");
  }
  if (!bucketName?.trim()) {
    throw new Error("R2_BUCKET_NAME is missing or empty");
  }

  return {
    accountId: accountId.trim(),
    accessKeyId: accessKeyId.trim(),
    secretAccessKey: secretAccessKey.trim(),
    bucketName: bucketName.trim(),
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
): Promise<{ objectKey: string; downloadUrl: string; expiresInSeconds: number }> {
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

/** Exported for tests that need to assert env loading without network I/O. */
export function requireR2EnvVar(name: string): string {
  return requireEnv(name);
}
