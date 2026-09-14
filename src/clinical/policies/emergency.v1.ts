import type { ClinicalPolicy } from "@/clinical/types";

export const emergencyPolicyV1: ClinicalPolicy = {
  policyId: "emergency",
  version: "1",
  rules: [
    {
      ruleId: "emergency.v1.chest_pain",
      version: "1",
      sourceId: "src.pending.emergency.chest_pain",
      clinicalReviewStatus: "pending_clinical_review",
      phase: "pre_inference",
      trigger: {
        type: "lexical",
        anyPhrases: [
          "chest pain",
          "pain in my chest",
          "crushing chest",
          "pressure in my chest",
          "chest pressure",
        ],
        negativePhrases: ["no chest pain", "without chest pain"],
      },
      onMatch: {
        divertEmergency: true,
        disposition: "emergency",
        injectClinicalFlags: ["emergency.chest_pain"],
      },
      rationale:
        "Declarative chest-pain red-flag matcher. Not clinically approved.",
    },
    {
      ruleId: "emergency.v1.fast_stroke",
      version: "1",
      sourceId: "src.pending.emergency.fast_stroke",
      clinicalReviewStatus: "pending_clinical_review",
      phase: "pre_inference",
      trigger: {
        type: "lexical",
        anyPhrases: [
          "face droop",
          "facial droop",
          "arm weakness",
          "cannot lift my arm",
          "slurred speech",
          "unable to speak",
          "signs of a stroke",
        ],
        negativePhrases: ["no stroke symptoms", "no facial droop"],
      },
      onMatch: {
        divertEmergency: true,
        disposition: "emergency",
        injectClinicalFlags: ["emergency.fast_stroke"],
      },
      rationale:
        "Declarative FAST-style neurological deficit matcher. Not clinically approved.",
    },
    {
      ruleId: "emergency.v1.respiratory_distress_stridor",
      version: "1",
      sourceId: "src.pending.emergency.respiratory_distress",
      clinicalReviewStatus: "pending_clinical_review",
      phase: "pre_inference",
      trigger: {
        type: "lexical",
        anyPhrases: [
          "stridor",
          "cannot breathe",
          "can't breathe",
          "gasping for air",
          "severe shortness of breath",
          "airway closing",
        ],
        negativePhrases: ["no breathing trouble", "breathing normally"],
      },
      onMatch: {
        divertEmergency: true,
        disposition: "emergency",
        injectClinicalFlags: ["emergency.respiratory_distress"],
      },
      rationale:
        "Declarative respiratory distress/stridor matcher. Not clinically approved.",
    },
    {
      ruleId: "emergency.v1.severe_anaphylaxis",
      version: "1",
      sourceId: "src.pending.emergency.anaphylaxis",
      clinicalReviewStatus: "pending_clinical_review",
      phase: "pre_inference",
      trigger: {
        type: "lexical",
        anyPhrases: [
          "anaphylaxis",
          "throat swelling after",
          "hives and trouble breathing",
          "allergic reaction and cannot breathe",
          "tongue swelling",
        ],
        negativePhrases: ["no allergic reaction"],
      },
      onMatch: {
        divertEmergency: true,
        disposition: "emergency",
        injectClinicalFlags: ["emergency.severe_anaphylaxis"],
      },
      rationale:
        "Declarative severe anaphylaxis matcher. Not clinically approved.",
    },
    {
      ruleId: "emergency.v1.inconsistency_escalation",
      version: "1",
      sourceId: "src.pending.post.inconsistency_escalation",
      clinicalReviewStatus: "pending_clinical_review",
      phase: "post_inference",
      trigger: {
        type: "disposition_inconsistency",
        candidateDispositions: ["routine", "self_care"],
        flagPhrasesAnyOf: [
          "high-concern",
          "high concern",
          "red flag",
          "red-flag",
          "emergency",
        ],
      },
      onMatch: {
        escalateAtLeast: "urgent",
        injectClinicalFlags: ["post.inconsistency_escalation"],
      },
      rationale:
        "If model notes include high-concern red flags but disposition is routine or self_care, escalate. Not clinically approved.",
    },
  ],
};
