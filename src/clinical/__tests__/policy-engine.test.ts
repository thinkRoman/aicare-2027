import { describe, expect, it } from "vitest";
import { postInferenceArbiter } from "@/services/ai/arbiter/postInferenceArbiter";
import { preInferenceArbiter } from "@/services/ai/arbiter/preInferenceArbiter";
import type { EncounterInput } from "@/lib/schemas/encounter";
import type { TriageResult } from "@/lib/schemas/triage";

type EncounterOverrides = Omit<Partial<EncounterInput>, "patientContext"> & {
  patientContext?: Partial<EncounterInput["patientContext"]>;
};

function baseEncounter(overrides: EncounterOverrides = {}): EncounterInput {
  const { patientContext, ...rest } = overrides;
  return {
    chiefComplaint: rest.chiefComplaint ?? "mild cough for two days",
    patientContext: {
      ageGroup: "adult",
      activeMedications: [],
      knownAllergies: [],
      ...patientContext,
    },
    anamnesis: rest.anamnesis ?? {},
    image: rest.image,
  };
}

function routineResult(overrides: Partial<TriageResult> = {}): TriageResult {
  return {
    disposition: "routine",
    rationale: "Candidate routine disposition for isolated testing.",
    plainEnglishSummary: "This is a candidate summary for isolated testing.",
    immediateActions: ["Rest and reassess if symptoms change."],
    redFlagsToMonitor: ["Worsening symptoms that concern you."],
    pointOfCareChecklist: ["Share the timeline of symptoms with a clinician."],
    confidenceScore: 0.4,
    clinicalFlags: [],
    ...overrides,
  };
}

describe("Gate 1 clinical policy engine", () => {
  it("diverts pre-inference evaluation for acute chest-pain red flags", () => {
    const encounter = baseEncounter({
      chiefComplaint: "sudden crushing chest pain radiating to my left arm",
    });

    const evaluation = preInferenceArbiter(encounter);

    expect(evaluation.diverted).toBe(true);
    expect(evaluation.disposition).toBe("emergency");
    expect(evaluation.matchedRuleIds).toContain("emergency.v1.chest_pain");
    expect(evaluation.clinicalSourceIds).toContain(
      "src.pending.emergency.chest_pain",
    );
    expect(evaluation.clinicalReviewStatus).toBe("pending_clinical_review");
  });

  it("does not infer pediatric age from ageGroup and does not fire without ageDays", () => {
    const encounter = baseEncounter({
      patientContext: {
        ageGroup: "infant",
        feverIndicated: true,
      },
    });

    const evaluation = postInferenceArbiter(routineResult(), encounter);

    expect(evaluation.matchedRuleIds).not.toContain(
      "pediatric.v1.infant_fever_escalation",
    );
    expect(evaluation.result.disposition).toBe("routine");
  });

  it("overrides a routine candidate to emergency for infant fever when ageDays < 90", () => {
    const encounter = baseEncounter({
      patientContext: {
        ageGroup: "infant",
        ageDays: 45,
        feverIndicated: true,
        temperatureC: 38.5,
      },
    });

    const evaluation = postInferenceArbiter(routineResult(), encounter);

    expect(evaluation.overridden).toBe(true);
    expect(evaluation.result.disposition).toBe("emergency");
    expect(evaluation.matchedRuleIds).toContain(
      "pediatric.v1.infant_fever_escalation",
    );
    expect(evaluation.clinicalReviewStatus).toBe("pending_clinical_review");
  });

  it("injects an in-person examination mandate when image quality is degraded", () => {
    const encounter = baseEncounter({
      image: {
        objectKey: "encounters/test/image.jpg",
        contentType: "image/jpeg",
        capturedAt: new Date("2026-09-13T00:00:00.000Z"),
        quality: {
          acceptable: false,
          issues: ["motion_blur", "uncertain"],
        },
      },
    });

    const evaluation = postInferenceArbiter(
      routineResult({ disposition: "self_care" }),
      encounter,
    );

    expect(evaluation.matchedRuleIds).toContain(
      "vision.v1.degraded_quality_exam_mandate",
    );
    expect(evaluation.result.immediateActions).toContain(
      "Seek in-person clinical inspection; image quality is too uncertain for reassurance.",
    );
    expect(evaluation.result.disposition).not.toBe("self_care");
    expect(evaluation.result.clinicalFlags).toContain("vision.degraded_quality");
  });

  it("escalates when candidate disposition conflicts with high-concern language", () => {
    const evaluation = postInferenceArbiter(
      routineResult({
        disposition: "routine",
        rationale: "Notes mention an emergency red flag pattern.",
        plainEnglishSummary: "High-concern findings were described.",
      }),
      baseEncounter(),
    );

    expect(evaluation.matchedRuleIds).toContain(
      "emergency.v1.inconsistency_escalation",
    );
    expect(evaluation.result.disposition).toBe("urgent");
  });
});
