import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Encounter } from "@/lib/db/models/Encounter";
import { resolveRequestIdentity } from "@/lib/security/identity";
import {
  assertAllowedContentType,
  generatePresignedUploadUrl,
} from "@/lib/storage/r2";

export const runtime = "nodejs";

const PresignRequestSchema = z.object({
  encounterId: z
    .string()
    .trim()
    .min(1)
    .regex(/^[A-Za-z0-9_-]+$/, "encounterId must be alphanumeric"),
  contentType: z.string().trim().min(1),
});

export async function POST(request: Request): Promise<Response> {
  const identity = await resolveRequestIdentity();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Request body must be JSON" },
      { status: 400 },
    );
  }

  const parsed = PresignRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid upload presign request",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    assertAllowedContentType(parsed.data.contentType);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unsupported content type",
      },
      { status: 400 },
    );
  }

  await connectToDatabase();
  const encounter = await Encounter.findOne({
    encounterId: parsed.data.encounterId,
  }).lean();

  if (!encounter) {
    return NextResponse.json(
      { ok: false, message: "Encounter not found" },
      { status: 404 },
    );
  }

  const ownsByDevice = encounter.deviceId === identity.deviceId;
  const ownsByUser =
    identity.userId !== null &&
    encounter.userId !== undefined &&
    encounter.userId === identity.userId;

  if (!ownsByDevice && !ownsByUser) {
    return NextResponse.json(
      { ok: false, message: "Not authorized for this encounter" },
      { status: 403 },
    );
  }

  try {
    const presigned = await generatePresignedUploadUrl({
      encounterId: parsed.data.encounterId,
      contentType: parsed.data.contentType,
    });

    return NextResponse.json({
      ok: true,
      objectKey: presigned.objectKey,
      uploadUrl: presigned.uploadUrl,
      expiresInSeconds: presigned.expiresInSeconds,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? "Failed to create private upload URL"
            : "Failed to create private upload URL",
      },
      { status: 500 },
    );
  }
}
