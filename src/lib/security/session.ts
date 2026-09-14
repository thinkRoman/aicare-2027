import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

export const DEVICE_ID_COOKIE_NAME = "aicare_device_id";
export const DEVICE_ID_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type DeviceIdCookieOptions = {
  httpOnly: true;
  sameSite: "strict";
  secure: boolean;
  path: "/";
  maxAge: number;
};

export function isValidDeviceId(value: string): boolean {
  return UUID_V4_PATTERN.test(value);
}

export function createAnonymousDeviceId(): string {
  return randomUUID();
}

export function buildDeviceIdCookieOptions(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): DeviceIdCookieOptions {
  return {
    httpOnly: true,
    sameSite: "strict",
    secure: nodeEnv === "production",
    path: "/",
    maxAge: DEVICE_ID_MAX_AGE_SECONDS,
  };
}

/**
 * Resolves the anonymous device session from the HttpOnly cookie.
 * Never trusts a caller-supplied device ID. Cookie stores only the UUID.
 */
export async function resolveAnonymousDeviceId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(DEVICE_ID_COOKIE_NAME)?.value;

  if (existing && isValidDeviceId(existing)) {
    return existing;
  }

  const deviceId = createAnonymousDeviceId();
  cookieStore.set(
    DEVICE_ID_COOKIE_NAME,
    deviceId,
    buildDeviceIdCookieOptions(),
  );
  return deviceId;
}
