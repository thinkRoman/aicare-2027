import { describe, expect, it } from "vitest";
import { BYOK_FAILURE_MESSAGE } from "@/services/ai/errors";
import {
  CONSUMER_CONSENT_TEXT,
  MIN_TOUCH_TARGET_PX,
  consumerSafeErrorMessage,
  urgencyPresentation,
} from "@/lib/consumer/triageUi";

describe("consumer triage UI helpers", () => {
  it("requires a minimum 48px touch target constant", () => {
    expect(MIN_TOUCH_TARGET_PX).toBe(48);
  });

  it("keeps consent wording non-diagnostic", () => {
    expect(CONSUMER_CONSENT_TEXT.toLowerCase()).toContain("triage guidance");
    expect(CONSUMER_CONSENT_TEXT.toLowerCase()).toContain(
      "not a medical diagnosis",
    );
  });

  it("maps urgency with text labels, not color alone", () => {
    const emergency = urgencyPresentation("emergency");
    expect(emergency.label).toBe("Emergency");
    expect(emergency.description.length).toBeGreaterThan(0);
  });

  it("surfaces the stable BYOK failure message", () => {
    expect(
      consumerSafeErrorMessage({
        ok: false,
        code: "BYOK_EXECUTION_FAILED",
        message: "raw provider boom",
        retryable: true,
      }),
    ).toBe(BYOK_FAILURE_MESSAGE);
  });

  it("uses a safe retry message for malformed model output", () => {
    expect(
      consumerSafeErrorMessage({
        ok: false,
        code: "MALFORMED_MODEL_OUTPUT",
        message: "schema exploded with stack",
        retryable: true,
      }),
    ).toBe("We could not complete triage safely. Please try again.");
  });

  it("never forwards arbitrary server text for unknown failures", () => {
    expect(
      consumerSafeErrorMessage({
        ok: false,
        code: "WEIRD",
        message: "sk-secret openai gpt-leak",
      }),
    ).toBe("Triage is temporarily unavailable. Please try again.");
  });
});
