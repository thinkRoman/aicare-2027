import type { ClinicalPolicy } from "@/clinical/types";

export const visionPolicyV1: ClinicalPolicy = {
  policyId: "vision",
  version: "1",
  rules: [
    {
      ruleId: "vision.v1.degraded_quality_exam_mandate",
      version: "1",
      sourceId: "src.pending.vision.degraded_quality",
      clinicalReviewStatus: "pending_clinical_review",
      phase: "post_inference",
      applicability: {
        requiresImage: true,
      },
      trigger: {
        type: "vision_quality",
        matchIfUnacceptable: true,
        issuesAnyOf: [
          "borderline",
          "uncertain",
          "motion_blur",
          "low_light",
          "glare",
          "low_resolution",
        ],
      },
      onMatch: {
        banDispositions: ["self_care"],
        escalateAtLeast: "urgent",
        injectImmediateActions: [
          "Seek in-person clinical inspection; image quality is too uncertain for reassurance.",
        ],
        injectPointOfCareChecklist: [
          "Document that visual quality was insufficient for remote reassurance.",
        ],
        injectClinicalFlags: ["vision.degraded_quality"],
      },
      rationale:
        "Degraded or uncertain image quality bans definitive self-care reassurance and requires in-person inspection. Not clinically approved.",
    },
  ],
};
