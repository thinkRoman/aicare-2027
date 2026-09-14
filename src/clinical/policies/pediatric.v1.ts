import type { ClinicalPolicy } from "@/clinical/types";

export const pediatricPolicyV1: ClinicalPolicy = {
  policyId: "pediatric",
  version: "1",
  rules: [
    {
      ruleId: "pediatric.v1.infant_fever_escalation",
      version: "1",
      sourceId: "src.pending.pediatric.infant_fever",
      clinicalReviewStatus: "pending_clinical_review",
      phase: "post_inference",
      applicability: {
        requiresAgeDays: true,
      },
      trigger: {
        type: "age_fever",
        ageDaysLessThan: 90,
        requireFeverIndicated: true,
      },
      onMatch: {
        disposition: "emergency",
        injectClinicalFlags: ["pediatric.infant_fever_escalation"],
      },
      rationale:
        "Contract example: ageDays < 90 with feverIndicated overrides a routine candidate to emergency. Age is never inferred from ageGroup. The numeric fever cutoff is not encoded and remains pending clinical review.",
    },
  ],
};
