import { NextResponse } from "next/server";
import { resolveRequestIdentity } from "@/lib/security/identity";
import { deleteEncounterWithArtifacts } from "@/services/triage/deleteEncounter";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ encounterId: string }>;
};

/**
 * DELETE /api/encounters/:encounterId
 * Purges the encounter document fields and deletes associated private R2 objects.
 * Identity and ownership come only from signed/server cookies — never from the body.
 */
export async function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  const { encounterId: rawId } = await context.params;
  const encounterId = rawId?.trim() ?? "";
  if (!encounterId || !/^[A-Za-z0-9_-]+$/.test(encounterId)) {
    return NextResponse.json(
      { ok: false, message: "Invalid encounter id" },
      { status: 400 },
    );
  }

  const identity = await resolveRequestIdentity();
  const result = await deleteEncounterWithArtifacts(encounterId, identity);

  if (!result.ok) {
    const status =
      result.code === "NOT_FOUND"
        ? 404
        : result.code === "FORBIDDEN"
          ? 403
          : result.code === "ALREADY_DELETED"
            ? 409
            : 500;
    return NextResponse.json(
      { ok: false, code: result.code, message: result.message },
      { status },
    );
  }

  return NextResponse.json({
    ok: true,
    encounterId: result.encounterId,
    status: result.status,
    imageDeleted: result.imageDeleted,
  });
}
