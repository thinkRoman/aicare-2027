import type { Disposition, TriageResult } from "@/lib/schemas/triage";
import { BYOK_FAILURE_MESSAGE } from "@/services/ai/errors";

export const CONSUMER_CONSENT_TEXT =
  "I understand aiCARE provides triage guidance, not a medical diagnosis." as const;

export type ConsumerTriageSuccess = {
  ok: true;
  encounterId: string;
  status: "triaged";
  triageResult: TriageResult & { overriddenBySafetyArbiter: boolean };
};

export type ConsumerTriageEmergency = {
  ok: true;
  encounterId: string;
  status: "diverted_emergency";
  emergency: { action: string; locale: string; known: boolean };
  matchedRuleIds: string[];
};

export type ConsumerTriageFailure = {
  ok: false;
  code?: "MALFORMED_MODEL_OUTPUT" | "BYOK_EXECUTION_FAILED" | "AI_FAILURE" | string;
  message?: string;
  retryable?: boolean;
};

export type ConsumerTriageResponse =
  | ConsumerTriageSuccess
  | ConsumerTriageEmergency
  | ConsumerTriageFailure;

export type UrgencyPresentation = {
  label: string;
  description: string;
  className: string;
};

export function urgencyPresentation(
  disposition: Disposition,
): UrgencyPresentation {
  switch (disposition) {
    case "emergency":
      return {
        label: "Emergency",
        description: "Seek emergency care now",
        className: "bg-red-700 text-white border-red-900",
      };
    case "urgent":
      return {
        label: "Urgent",
        description: "Seek prompt in-person care",
        className: "bg-amber-600 text-white border-amber-800",
      };
    case "routine":
      return {
        label: "Routine",
        description: "Plan a non-urgent clinical visit",
        className: "bg-sky-700 text-white border-sky-900",
      };
    case "self_care":
      return {
        label: "Home Care",
        description: "Self-care with monitoring",
        className: "bg-emerald-700 text-white border-emerald-900",
      };
  }
}

export function consumerSafeErrorMessage(
  failure: ConsumerTriageFailure,
): string {
  if (failure.code === "BYOK_EXECUTION_FAILED") {
    return BYOK_FAILURE_MESSAGE;
  }
  if (failure.code === "MALFORMED_MODEL_OUTPUT") {
    return "We could not complete triage safely. Please try again.";
  }
  return "Triage is temporarily unavailable. Please try again.";
}

export const MIN_TOUCH_TARGET_PX = 48;
