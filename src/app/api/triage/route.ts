import { NextResponse } from "next/server";
import { resolveRequestIdentity } from "@/lib/security/identity";
import { mongoEncounterPersistence } from "@/services/triage/encounterPersistence";
import {
  TriageRequestSchema,
  runTriagePipeline,
} from "@/services/triage/runTriagePipeline";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Request body must be JSON" },
      { status: 400 },
    );
  }

  const parsed = TriageRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid triage request",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  if (parsed.data.consentAcknowledged !== true) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Consent is required. aiCARE provides triage guidance, not a medical diagnosis.",
      },
      { status: 400 },
    );
  }

  const identity = await resolveRequestIdentity();
  const acceptLanguage = request.headers.get("accept-language");
  const locale =
    parsed.data.locale ??
    acceptLanguage?.split(",")[0]?.split(";")[0] ??
    null;

  const result = await runTriagePipeline(parsed.data, {
    identity,
    locale,
    persist: mongoEncounterPersistence,
  });

  if (!result.ok) {
    const status =
      result.code === "BYOK_EXECUTION_FAILED"
        ? 502
        : result.code === "MALFORMED_MODEL_OUTPUT"
          ? 502
          : 502;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result, { status: 200 });
}
