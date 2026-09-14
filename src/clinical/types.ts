import type { Disposition } from "@/lib/schemas/triage";

export type PolicyPhase = "pre_inference" | "post_inference";

export type LexicalTrigger = {
  type: "lexical";
  anyPhrases?: string[];
  anyPatterns?: string[];
  allPhrases?: string[];
  negativePhrases?: string[];
  negativePatterns?: string[];
};

export type AgeFeverTrigger = {
  type: "age_fever";
  ageDaysLessThan: number;
  requireFeverIndicated: true;
};

export type VisionQualityTrigger = {
  type: "vision_quality";
  matchIfUnacceptable: boolean;
  issuesAnyOf: string[];
};

export type InconsistencyTrigger = {
  type: "disposition_inconsistency";
  candidateDispositions: Disposition[];
  flagPhrasesAnyOf: string[];
};

export type PolicyTrigger =
  | LexicalTrigger
  | AgeFeverTrigger
  | VisionQualityTrigger
  | InconsistencyTrigger;

export type RuleApplicability = {
  isPregnant?: boolean;
  requiresAgeDays?: boolean;
  requiresImage?: boolean;
};

export type RuleOnMatch = {
  divertEmergency?: boolean;
  disposition?: Disposition;
  escalateAtLeast?: Disposition;
  banDispositions?: Disposition[];
  injectImmediateActions?: string[];
  injectClinicalFlags?: string[];
  injectPointOfCareChecklist?: string[];
};

export type ClinicalRule = {
  ruleId: string;
  version: string;
  sourceId: string;
  clinicalReviewStatus: "verified" | "pending_clinical_review";
  phase: PolicyPhase;
  applicability?: RuleApplicability;
  trigger: PolicyTrigger;
  onMatch: RuleOnMatch;
  rationale: string;
};

export type ClinicalPolicy = {
  policyId: string;
  version: string;
  rules: ClinicalRule[];
};

export type PolicyMatch = {
  ruleId: string;
  version: string;
  sourceId: string;
  policyId: string;
  policyVersion: string;
  clinicalReviewStatus: "verified" | "pending_clinical_review";
  rationale: string;
};
