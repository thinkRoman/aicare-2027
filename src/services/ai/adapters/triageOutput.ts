import { TriageResultSchema, type TriageResult } from "@/lib/schemas/triage";
import { AIResponseValidationError } from "@/services/ai/errors";

/** JSON Schema fragment for provider structured-output APIs (not clinical policy). */
export const TRIAGE_RESULT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "disposition",
    "rationale",
    "plainEnglishSummary",
    "immediateActions",
    "redFlagsToMonitor",
    "pointOfCareChecklist",
    "confidenceScore",
    "clinicalFlags",
  ],
  properties: {
    disposition: {
      type: "string",
      enum: ["emergency", "urgent", "routine", "self_care"],
    },
    rationale: { type: "string", minLength: 10, maxLength: 500 },
    plainEnglishSummary: { type: "string", minLength: 10, maxLength: 600 },
    immediateActions: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: { type: "string", minLength: 3, maxLength: 200 },
    },
    redFlagsToMonitor: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: { type: "string", minLength: 3, maxLength: 200 },
    },
    pointOfCareChecklist: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: { type: "string", minLength: 3, maxLength: 200 },
    },
    confidenceScore: { type: "number", minimum: 0, maximum: 1 },
    clinicalFlags: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

export const STRUCTURED_OUTPUT_INSTRUCTION =
  "Return only structured triage guidance JSON matching the required schema. Do not include conversational prose outside the schema fields. This is triage guidance, not a medical diagnosis." as const;

export function parseUnknownTriageResult(candidate: unknown): TriageResult {
  const parsed = TriageResultSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new AIResponseValidationError(
      "Model output failed TriageResult schema validation",
      {
        diagnostic: parsed.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; "),
      },
    );
  }
  return parsed.data;
}

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new AIResponseValidationError("Model returned empty output");
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
      } catch {
        throw new AIResponseValidationError(
          "Model returned non-JSON conversational output",
        );
      }
    }
    throw new AIResponseValidationError(
      "Model returned non-JSON conversational output",
    );
  }
}
