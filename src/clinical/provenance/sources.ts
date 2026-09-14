export type ClinicalReviewStatus = "verified" | "pending_clinical_review";

export interface ClinicalSource {
  id: string;
  organization: string;
  guidelineTitle: string;
  versionOrYear: string;
  identifierOrUrl?: string;
  effectiveDate: string;
  status: ClinicalReviewStatus;
  supportedRuleId: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export const CLINICAL_SOURCES: ClinicalSource[] = [
  {
    id: "src.pending.emergency.chest_pain",
    organization: "Unassigned",
    guidelineTitle: "Not yet assigned — not a clinical citation",
    versionOrYear: "unspecified",
    effectiveDate: "unspecified",
    status: "pending_clinical_review",
    supportedRuleId: "emergency.v1.chest_pain",
  },
  {
    id: "src.pending.emergency.fast_stroke",
    organization: "Unassigned",
    guidelineTitle: "Not yet assigned — not a clinical citation",
    versionOrYear: "unspecified",
    effectiveDate: "unspecified",
    status: "pending_clinical_review",
    supportedRuleId: "emergency.v1.fast_stroke",
  },
  {
    id: "src.pending.emergency.respiratory_distress",
    organization: "Unassigned",
    guidelineTitle: "Not yet assigned — not a clinical citation",
    versionOrYear: "unspecified",
    effectiveDate: "unspecified",
    status: "pending_clinical_review",
    supportedRuleId: "emergency.v1.respiratory_distress_stridor",
  },
  {
    id: "src.pending.emergency.anaphylaxis",
    organization: "Unassigned",
    guidelineTitle: "Not yet assigned — not a clinical citation",
    versionOrYear: "unspecified",
    effectiveDate: "unspecified",
    status: "pending_clinical_review",
    supportedRuleId: "emergency.v1.severe_anaphylaxis",
  },
  {
    id: "src.pending.pediatric.infant_fever",
    organization: "Unassigned",
    guidelineTitle: "Not yet assigned — not a clinical citation",
    versionOrYear: "unspecified",
    effectiveDate: "unspecified",
    status: "pending_clinical_review",
    supportedRuleId: "pediatric.v1.infant_fever_escalation",
  },
  {
    id: "src.pending.pregnancy.obstetric_red_flag",
    organization: "Unassigned",
    guidelineTitle: "Not yet assigned — not a clinical citation",
    versionOrYear: "unspecified",
    effectiveDate: "unspecified",
    status: "pending_clinical_review",
    supportedRuleId: "pregnancy.v1.obstetric_red_flag",
  },
  {
    id: "src.pending.vision.degraded_quality",
    organization: "Unassigned",
    guidelineTitle: "Not yet assigned — not a clinical citation",
    versionOrYear: "unspecified",
    effectiveDate: "unspecified",
    status: "pending_clinical_review",
    supportedRuleId: "vision.v1.degraded_quality_exam_mandate",
  },
  {
    id: "src.pending.post.inconsistency_escalation",
    organization: "Unassigned",
    guidelineTitle: "Not yet assigned — not a clinical citation",
    versionOrYear: "unspecified",
    effectiveDate: "unspecified",
    status: "pending_clinical_review",
    supportedRuleId: "emergency.v1.inconsistency_escalation",
  },
];

export function getClinicalSourceById(id: string): ClinicalSource | undefined {
  return CLINICAL_SOURCES.find((source) => source.id === id);
}

export function getClinicalSourceForRule(
  ruleId: string,
): ClinicalSource | undefined {
  return CLINICAL_SOURCES.find((source) => source.supportedRuleId === ruleId);
}
