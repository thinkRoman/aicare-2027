import {
  getAuthenticatedSession,
  userIdFromEmail,
} from "@/lib/security/auth";
import { resolveAnonymousDeviceId } from "@/lib/security/session";

export type RequestIdentity = {
  deviceId: string;
  /** Authenticated user id when a signed session cookie is present. */
  userId: string | null;
};

export type IdentityResolver = () => Promise<RequestIdentity>;

/**
 * Resolves server-side ownership.
 * Device id always comes from the HttpOnly device cookie — never from the client body.
 * User id comes only from the signed HttpOnly auth session cookie (re-derived from email).
 * Client-supplied userId fields in request bodies are ignored.
 */
export async function resolveRequestIdentity(): Promise<RequestIdentity> {
  const deviceId = await resolveAnonymousDeviceId();
  const session = await getAuthenticatedSession();
  return {
    deviceId,
    userId: session ? userIdFromEmail(session.email) : null,
  };
}
