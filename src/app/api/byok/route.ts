import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/mongodb";
import { UserAiConfig } from "@/lib/db/models/UserAiConfig";
import { encryptSecret } from "@/lib/security/crypto";
import { resolveRequestIdentity } from "@/lib/security/identity";
import { normalizeLocalBaseUrl } from "@/services/ai/config";

export const runtime = "nodejs";

const ByokUpsertSchema = z.object({
  action: z.literal("upsert"),
  provider: z.enum(["openai", "anthropic", "local"]),
  selectedModel: z.string().trim().min(1).max(200),
  apiKey: z.string().min(1).max(4096),
  baseUrl: z.string().trim().url().optional(),
});

const ByokDisableSchema = z.object({
  action: z.literal("disable"),
});

const ByokDeleteSchema = z.object({
  action: z.literal("delete"),
});

const ByokRequestSchema = z.union([
  ByokUpsertSchema,
  ByokDisableSchema,
  ByokDeleteSchema,
]);

function keyLast4(secret: string): string {
  const trimmed = secret.trim();
  if (trimmed.length < 4) {
    return trimmed.padStart(4, "*");
  }
  return trimmed.slice(-4);
}

function sanitizedResponse(doc: {
  provider: string;
  selectedModel: string;
  keyLast4?: string | null;
  updatedAt?: Date;
  disabled?: boolean;
}) {
  return {
    provider: doc.provider,
    selectedModel: doc.selectedModel,
    keyLast4: doc.keyLast4 ?? undefined,
    updatedAt: doc.updatedAt?.toISOString() ?? new Date().toISOString(),
    disabled: doc.disabled === true,
  };
}

export async function GET(): Promise<Response> {
  const identity = await resolveRequestIdentity();
  if (!identity.userId) {
    return NextResponse.json(
      { ok: false, message: "Authentication required for BYOK settings" },
      { status: 401 },
    );
  }

  await connectToDatabase();
  const doc = await UserAiConfig.findOne({ userId: identity.userId }).lean();
  if (!doc) {
    return NextResponse.json({ ok: true, config: null });
  }

  return NextResponse.json({
    ok: true,
    config: sanitizedResponse(doc),
  });
}

export async function PUT(request: Request): Promise<Response> {
  const identity = await resolveRequestIdentity();
  if (!identity.userId) {
    return NextResponse.json(
      { ok: false, message: "Authentication required for BYOK settings" },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Request body must be JSON" },
      { status: 400 },
    );
  }

  const parsed = ByokRequestSchema.safeParse(
    typeof body === "object" && body !== null && !("action" in body)
      ? { ...(body as object), action: "upsert" }
      : body,
  );

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid BYOK request",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  await connectToDatabase();
  const userId = identity.userId;

  if (parsed.data.action === "delete") {
    await UserAiConfig.deleteOne({ userId });
    return NextResponse.json({ ok: true, config: null });
  }

  if (parsed.data.action === "disable") {
    const doc = await UserAiConfig.findOneAndUpdate(
      { userId },
      { $set: { disabled: true } },
      { new: true },
    ).lean();

    if (!doc) {
      return NextResponse.json(
        { ok: false, message: "No BYOK configuration to disable" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      config: sanitizedResponse(doc),
    });
  }

  const { provider, selectedModel, apiKey } = parsed.data;
  let baseUrl = parsed.data.baseUrl;
  if (provider === "local") {
    baseUrl = normalizeLocalBaseUrl(
      baseUrl ?? process.env.LOCAL_AI_BASE_URL ?? "http://127.0.0.1:1234/v1",
    );
  } else if (baseUrl) {
    baseUrl = normalizeLocalBaseUrl(baseUrl);
  }

  const encryptedCredential = encryptSecret(apiKey);
  const last4 = keyLast4(apiKey);

  const doc = await UserAiConfig.findOneAndUpdate(
    { userId },
    {
      $set: {
        userId,
        provider,
        selectedModel,
        encryptedCredential,
        keyLast4: last4,
        baseUrl,
        disabled: false,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

  if (!doc) {
    return NextResponse.json(
      { ok: false, message: "Failed to persist BYOK configuration" },
      { status: 500 },
    );
  }

  // Never include plaintext or ciphertext in the response.
  return NextResponse.json({
    ok: true,
    config: sanitizedResponse(doc),
  });
}

export async function DELETE(): Promise<Response> {
  const identity = await resolveRequestIdentity();
  if (!identity.userId) {
    return NextResponse.json(
      { ok: false, message: "Authentication required for BYOK settings" },
      { status: 401 },
    );
  }

  await connectToDatabase();
  await UserAiConfig.deleteOne({ userId: identity.userId });
  return NextResponse.json({ ok: true, config: null });
}
