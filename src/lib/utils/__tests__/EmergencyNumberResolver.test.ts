import { describe, expect, it } from "vitest";
import {
  UNKNOWN_EMERGENCY_ACTION,
  resolveEmergencyAction,
} from "@/lib/utils/EmergencyNumberResolver";

describe("EmergencyNumberResolver", () => {
  it("returns exactly one US emergency action", () => {
    const result = resolveEmergencyAction("en-US");
    expect(result.action).toBe("Call 911");
    expect(result.known).toBe(true);
    expect(result.action.includes("112")).toBe(false);
    expect(result.action.includes("999")).toBe(false);
  });

  it("falls back when locale is unknown", () => {
    expect(resolveEmergencyAction(null).action).toBe(UNKNOWN_EMERGENCY_ACTION);
    expect(resolveEmergencyAction("zz-ZZ").action).toBe(
      UNKNOWN_EMERGENCY_ACTION,
    );
  });
});
