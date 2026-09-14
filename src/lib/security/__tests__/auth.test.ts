import { afterEach, describe, expect, it } from "vitest";
import {
  buildUserSessionCookieOptions,
  createUserSessionToken,
  userIdFromEmail,
  verifyUserSessionToken,
  USER_SESSION_MAX_AGE_SECONDS,
} from "@/lib/security/auth";

describe("authenticated identity helpers", () => {
  const previous = process.env.NEXTAUTH_SECRET;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.NEXTAUTH_SECRET;
    } else {
      process.env.NEXTAUTH_SECRET = previous;
    }
  });

  it("derives a stable server-side user id from email", () => {
    const a = userIdFromEmail("Person@Example.com");
    const b = userIdFromEmail("person@example.com");
    expect(a).toBe(b);
    expect(a).toHaveLength(32);
  });

  it("ignores forged userId values inside an otherwise signed payload", () => {
    process.env.NEXTAUTH_SECRET =
      "auth-test-secret-with-at-least-32-characters";
    const email = "owner@example.com";
    const token = createUserSessionToken({
      userId: "forged-id",
      email,
    });
    expect(verifyUserSessionToken(token)).toEqual({
      userId: userIdFromEmail(email),
      email,
    });
  });

  it("builds HttpOnly SameSite=Strict cookies with bounded lifetime", () => {
    expect(buildUserSessionCookieOptions("production")).toEqual({
      httpOnly: true,
      sameSite: "strict",
      secure: true,
      path: "/",
      maxAge: USER_SESSION_MAX_AGE_SECONDS,
    });
  });
});
