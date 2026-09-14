import { resolveAnonymousDeviceId } from "@/lib/security/session";

export type RequestIdentity = {
  deviceId: string;
  /** Authenticated user id when available; null for anonymous consumers. */
  userId: string | null;
};

export type IdentityResolver = () => Promise<RequestIdentity>;

/**
 * Resolves server-side ownership.
 * Device id always comes from the HttpOnly session cookie — never from the client body.
 * Authenticated user binding is reserved for the auth layer; default is anonymous.
 */
export async function resolveRequestIdentity(): Promise<RequestIdentity> {
  const deviceId = await resolveAnonymousDeviceId();
  return {
    deviceId,
    userId: null,
  };
}
