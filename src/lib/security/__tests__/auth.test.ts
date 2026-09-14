import { describe, expect, it } from "vitest";
import { userIdFromEmail } from "@/lib/security/auth";

describe("authenticated identity helpers", () => {
  it("derives a stable server-side user id from email", () => {
    const a = userIdFromEmail("Person@Example.com");
    const b = userIdFromEmail("person@example.com");
    expect(a).toBe(b);
    expect(a).toHaveLength(32);
  });

  it("does not treat client-supplied user ids as part of email hashing input", () => {
    expect(userIdFromEmail("a@b.com")).not.toContain("user-");
  });
});
