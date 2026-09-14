import { NextResponse } from "next/server";
import { z } from "zod";
import {
  clearAuthenticatedSession,
  createUserId,
  getAuthenticatedSession,
  setAuthenticatedSession,
} from "@/lib/security/auth";

export const runtime = "nodejs";

const SignInSchema = z.object({
  email: z.string().trim().email().max(320),
});

export async function GET(): Promise<Response> {
  try {
    const session = await getAuthenticatedSession();
    if (!session) {
      return NextResponse.json({
        ok: true,
        authenticated: false,
        user: null,
      });
    }
    return NextResponse.json({
      ok: true,
      authenticated: true,
      user: {
        userId: session.userId,
        email: session.email,
      },
    });
  } catch {
    return NextResponse.json({
      ok: true,
      authenticated: false,
      user: null,
      message: "Authentication is not configured",
    });
  }
}

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

  const parsed = SignInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "A valid email is required to sign in" },
      { status: 400 },
    );
  }

  try {
    const session = {
      userId: createUserId(),
      email: parsed.data.email.toLowerCase(),
    };
    await setAuthenticatedSession(session);
    return NextResponse.json({
      ok: true,
      authenticated: true,
      user: session,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Sign-in is unavailable until NEXTAUTH_SECRET is configured on the server",
      },
      { status: 503 },
    );
  }
}

export async function DELETE(): Promise<Response> {
  await clearAuthenticatedSession();
  return NextResponse.json({ ok: true, authenticated: false, user: null });
}
