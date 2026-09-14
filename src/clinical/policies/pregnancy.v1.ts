import type { ClinicalPolicy } from "@/clinical/types";

export const pregnancyPolicyV1: ClinicalPolicy = {
  policyId: "pregnancy",
  version: "1",
  rules: [
    {
      ruleId: "pregnancy.v1.obstetric_red_flag",
      version: "1",
      sourceId: "src.pending.pregnancy.obstetric_red_flag",
      clinicalReviewStatus: "pending_clinical_review",
      phase: "pre_inference",
      applicability: {
        isPregnant: true,
      },
      trigger: {
        type: "lexical",
        anyPhrases: [
          "vaginal bleeding",
          "heavy bleeding in pregnancy",
          "no fetal movement",
          "reduced fetal movement",
          "severe headache in pregnancy",
          "vision changes in pregnancy",
          "seizure in pregnancy",
        ],
      },
      onMatch: {
        divertEmergency: true,
        disposition: "emergency",
        injectClinicalFlags: ["pregnancy.obstetric_red_flag"],
      },
      rationale:
        "Declarative obstetric red-flag matcher applied only when isPregnant is true. Not clinically approved.",
    },
  ],
};
