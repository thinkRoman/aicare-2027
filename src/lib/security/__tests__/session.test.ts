import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieGet = vi.fn();
const cookieSet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: cookieGet,
    set: cookieSet,
  })),
}));

import {
  DEVICE_ID_COOKIE_NAME,
  DEVICE_ID_MAX_AGE_SECONDS,
  buildDeviceIdCookieOptions,
  createAnonymousDeviceId,
  isValidDeviceId,
  resolveAnonymousDeviceId,
} from "@/lib/security/session";

describe("anonymous device sessions", () => {
  beforeEach(() => {
    cookieGet.mockReset();
    cookieSet.mockReset();
  });

  it("generates cryptographically random UUID device IDs", () => {
    const first = createAnonymousDeviceId();
    const second = createAnonymousDeviceId();
    expect(isValidDeviceId(first)).toBe(true);
    expect(isValidDeviceId(second)).toBe(true);
    expect(first).not.toBe(second);
  });

  it("builds HttpOnly SameSite=Strict cookie options with bounded lifetime", () => {
    const development = buildDeviceIdCookieOptions("development");
    expect(development).toEqual({
      httpOnly: true,
      sameSite: "strict",
      secure: false,
      path: "/",
      maxAge: DEVICE_ID_MAX_AGE_SECONDS,
    });

    const production = buildDeviceIdCookieOptions("production");
    expect(production.secure).toBe(true);
    expect(production.httpOnly).toBe(true);
    expect(production.sameSite).toBe("strict");
    expect(production.maxAge).toBeGreaterThan(0);
  });

  it("reuses a valid cookie value and never trusts caller-supplied IDs", async () => {
    const existing = createAnonymousDeviceId();
    cookieGet.mockReturnValue({ value: existing });

    const resolved = await resolveAnonymousDeviceId();
    expect(resolved).toBe(existing);
    expect(cookieSet).not.toHaveBeenCalled();
    expect(cookieGet).toHaveBeenCalledWith(DEVICE_ID_COOKIE_NAME);
  });

  it("rejects invalid cookie values and issues a new device ID", async () => {
    cookieGet.mockReturnValue({ value: "not-a-uuid" });

    const resolved = await resolveAnonymousDeviceId();
    expect(isValidDeviceId(resolved)).toBe(true);
    expect(cookieSet).toHaveBeenCalledWith(
      DEVICE_ID_COOKIE_NAME,
      resolved,
      expect.objectContaining({
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        maxAge: DEVICE_ID_MAX_AGE_SECONDS,
      }),
    );
  });
});
