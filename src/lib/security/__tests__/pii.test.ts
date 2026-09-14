import { describe, expect, it } from "vitest";
import { stripCommonPii } from "@/lib/security/pii";

describe("stripCommonPii", () => {
  it("redacts email, phone, SSN, and address-like text", () => {
    const input =
      "Call me at jane.doe@example.com or +1 (415) 555-0100. SSN 123-45-6789. I live at 123 Main Street.";
    const scrubbed = stripCommonPii(input);
    expect(scrubbed).toContain("[REDACTED_EMAIL]");
    expect(scrubbed).toContain("[REDACTED_PHONE]");
    expect(scrubbed).toContain("[REDACTED_SSN]");
    expect(scrubbed).toContain("[REDACTED_ADDRESS]");
    expect(scrubbed).not.toContain("jane.doe@example.com");
    expect(scrubbed).not.toContain("123-45-6789");
  });
});
