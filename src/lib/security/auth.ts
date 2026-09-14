import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const USER_SESSION_COOKIE_NAME = "aicare_user_session";
export const USER_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type AuthenticatedSession = {
  userId: string;
  email: string;
};

function sessionSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      "NEXTAUTH_SECRET must be set to a value of at least 32 characters for signed user sessions",
    );
  }
  return secret;
}

function signPayload(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("hex");
}

export function createUserSessionToken(session: AuthenticatedSession): string {
  const payload = Buffer.from(
    JSON.stringify({
      userId: session.userId,
      email: session.email,
    }),
    "utf8",
  ).toString("base64url");
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

export function verifyUserSessionToken(
  token: string,
): AuthenticatedSession | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return null;
  }

  let expected: string;
  try {
    expected = signPayload(payload);
  } catch {
    return null;
  }

  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { userId?: unknown; email?: unknown };
    if (
      typeof decoded.userId !== "string" ||
      decoded.userId.trim() === "" ||
      typeof decoded.email !== "string" ||
      decoded.email.trim() === ""
    ) {
      return null;
    }
    return {
      userId: decoded.userId,
      email: decoded.email.trim().toLowerCase(),
    };
  } catch {
    return null;
  }
}

export function buildUserSessionCookieOptions(
  nodeEnv: string | undefined = process.env.NODE_ENV,
) {
  return {
    httpOnly: true as const,
    sameSite: "strict" as const,
    secure: nodeEnv === "production",
    path: "/" as const,
    maxAge: USER_SESSION_MAX_AGE_SECONDS,
  };
}

/**
 * Reads the authenticated user from the signed HttpOnly session cookie.
 * Never trusts a client-supplied user id.
 */
export async function getAuthenticatedSession(): Promise<AuthenticatedSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  return verifyUserSessionToken(token);
}

export async function setAuthenticatedSession(
  session: AuthenticatedSession,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(
    USER_SESSION_COOKIE_NAME,
    createUserSessionToken(session),
    buildUserSessionCookieOptions(),
  );
}

export async function clearAuthenticatedSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(USER_SESSION_COOKIE_NAME, "", {
    ...buildUserSessionCookieOptions(),
    maxAge: 0,
  });
}

export function createUserId(): string {
  return randomUUID();
}
