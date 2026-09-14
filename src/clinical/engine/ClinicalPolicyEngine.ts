import { emergencyPolicyV1 } from "@/clinical/policies/emergency.v1";
import { pediatricPolicyV1 } from "@/clinical/policies/pediatric.v1";
import { pregnancyPolicyV1 } from "@/clinical/policies/pregnancy.v1";
import { visionPolicyV1 } from "@/clinical/policies/vision.v1";
import { getClinicalSourceById } from "@/clinical/provenance/sources";
import type {
  ClinicalPolicy,
  ClinicalRule,
  PolicyMatch,
  PolicyTrigger,
} from "@/clinical/types";
import type { EncounterInput } from "@/lib/schemas/encounter";
import type { Disposition, TriageResult } from "@/lib/schemas/triage";

const ACTIVE_POLICIES: ClinicalPolicy[] = [
  emergencyPolicyV1,
  pediatricPolicyV1,
  pregnancyPolicyV1,
  visionPolicyV1,
];

const DISPOSITION_RANK: Record<Disposition, number> = {
  self_care: 0,
  routine: 1,
  urgent: 2,
  emergency: 3,
};

export type PreInferenceEvaluation = {
  diverted: boolean;
  disposition: Disposition | null;
  matchedRules: PolicyMatch[];
  policyVersions: string[];
  matchedRuleIds: string[];
  clinicalSourceIds: string[];
  clinicalReviewStatus: "verified" | "pending_clinical_review";
  injectedClinicalFlags: string[];
};

export type PostInferenceEvaluation = {
  overridden: boolean;
  result: TriageResult;
  matchedRules: PolicyMatch[];
  policyVersions: string[];
  matchedRuleIds: string[];
  clinicalSourceIds: string[];
  clinicalReviewStatus: "verified" | "pending_clinical_review";
};

function policyVersionTag(policy: ClinicalPolicy): string {
  return `${policy.policyId}.v${policy.version}`;
}

function normalize(text: string): string {
  return text.toLowerCase();
}

function encounterHaystack(encounter: EncounterInput): string {
  const anamnesis = [
    encounter.anamnesis.onset,
    encounter.anamnesis.provocation,
    encounter.anamnesis.quality,
    encounter.anamnesis.radiation,
    encounter.anamnesis.timing,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ");

  return normalize(`${encounter.chiefComplaint} ${anamnesis}`);
}

function resultHaystack(result: TriageResult): string {
  return normalize(
    [
      result.rationale,
      result.plainEnglishSummary,
      ...result.clinicalFlags,
      ...result.redFlagsToMonitor,
    ].join(" "),
  );
}

function containsPhrase(haystack: string, phrase: string): boolean {
  return haystack.includes(normalize(phrase));
}

function containsPattern(haystack: string, pattern: string): boolean {
  return new RegExp(pattern, "i").test(haystack);
}

function isApplicable(rule: ClinicalRule, encounter: EncounterInput): boolean {
  const applicability = rule.applicability;
  if (!applicability) {
    return true;
  }
  if (
    applicability.isPregnant !== undefined &&
    encounter.patientContext.isPregnant !== applicability.isPregnant
  ) {
    return false;
  }
  if (applicability.requiresAgeDays && encounter.patientContext.ageDays === undefined) {
    return false;
  }
  if (applicability.requiresImage && encounter.image === undefined) {
    return false;
  }
  return true;
}

function matchesLexical(
  trigger: Extract<PolicyTrigger, { type: "lexical" }>,
  haystack: string,
): boolean {
  const negativePhrases = trigger.negativePhrases ?? [];
  if (negativePhrases.some((phrase) => containsPhrase(haystack, phrase))) {
    return false;
  }
  const negativePatterns = trigger.negativePatterns ?? [];
  if (negativePatterns.some((pattern) => containsPattern(haystack, pattern))) {
    return false;
  }

  const allPhrases = trigger.allPhrases ?? [];
  if (allPhrases.length > 0 && !allPhrases.every((phrase) => containsPhrase(haystack, phrase))) {
    return false;
  }

  const anyPhrases = trigger.anyPhrases ?? [];
  const anyPatterns = trigger.anyPatterns ?? [];
  if (anyPhrases.length === 0 && anyPatterns.length === 0 && allPhrases.length > 0) {
    return true;
  }

  return (
    anyPhrases.some((phrase) => containsPhrase(haystack, phrase)) ||
    anyPatterns.some((pattern) => containsPattern(haystack, pattern))
  );
}

function matchesTrigger(
  trigger: PolicyTrigger,
  encounter: EncounterInput,
  result: TriageResult | null,
): boolean {
  switch (trigger.type) {
    case "lexical":
      return matchesLexical(trigger, encounterHaystack(encounter));
    case "age_fever": {
      const ageDays = encounter.patientContext.ageDays;
      if (ageDays === undefined) {
        return false;
      }
      const feverOk = trigger.requireFeverIndicated
        ? encounter.patientContext.feverIndicated === true
        : true;
      return ageDays < trigger.ageDaysLessThan && feverOk;
    }
    case "vision_quality": {
      const quality = encounter.image?.quality;
      if (!quality) {
        return false;
      }
      const issueHit = quality.issues.some((issue) =>
        trigger.issuesAnyOf.includes(issue),
      );
      const unacceptable = trigger.matchIfUnacceptable && quality.acceptable === false;
      return issueHit || unacceptable;
    }
    case "disposition_inconsistency": {
      if (!result) {
        return false;
      }
      if (!trigger.candidateDispositions.includes(result.disposition)) {
        return false;
      }
      return trigger.flagPhrasesAnyOf.some((phrase) =>
        containsPhrase(resultHaystack(result), phrase),
      );
    }
  }
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function cappedUnique(values: string[], max: number): string[] {
  return uniqueStrings(values).slice(0, max);
}

function maxDisposition(left: Disposition, right: Disposition): Disposition {
  return DISPOSITION_RANK[left] >= DISPOSITION_RANK[right] ? left : right;
}

function reviewStatusFromMatches(
  matches: PolicyMatch[],
): "verified" | "pending_clinical_review" {
  if (matches.some((match) => match.clinicalReviewStatus !== "verified")) {
    return "pending_clinical_review";
  }
  if (matches.length === 0) {
    return "pending_clinical_review";
  }
  return "verified";
}

function collectMatches(
  phase: "pre_inference" | "post_inference",
  encounter: EncounterInput,
  result: TriageResult | null,
): { matches: PolicyMatch[]; rules: ClinicalRule[] } {
  const matches: PolicyMatch[] = [];
  const rules: ClinicalRule[] = [];

  for (const policy of ACTIVE_POLICIES) {
    for (const rule of policy.rules) {
      if (rule.phase !== phase) {
        continue;
      }
      if (!isApplicable(rule, encounter)) {
        continue;
      }
      if (!matchesTrigger(rule.trigger, encounter, result)) {
        continue;
      }

      const source = getClinicalSourceById(rule.sourceId);
      if (!source) {
        throw new Error(`Missing clinical provenance for source ${rule.sourceId}`);
      }
      if (source.supportedRuleId !== rule.ruleId) {
        throw new Error(
          `Provenance ${source.id} does not support rule ${rule.ruleId}`,
        );
      }

      rules.push(rule);
      matches.push({
        ruleId: rule.ruleId,
        version: rule.version,
        sourceId: rule.sourceId,
        policyId: policy.policyId,
        policyVersion: policyVersionTag(policy),
        clinicalReviewStatus: rule.clinicalReviewStatus,
        rationale: rule.rationale,
      });
    }
  }

  return { matches, rules };
}

function applyPostMatch(
  result: TriageResult,
  rules: ClinicalRule[],
): TriageResult {
  let disposition = result.disposition;
  const immediateActions = [...result.immediateActions];
  const clinicalFlags = [...result.clinicalFlags];
  const pointOfCareChecklist = [...result.pointOfCareChecklist];

  for (const rule of rules) {
    if (rule.onMatch.disposition) {
      disposition = rule.onMatch.disposition;
    }
    if (rule.onMatch.escalateAtLeast) {
      disposition = maxDisposition(disposition, rule.onMatch.escalateAtLeast);
    }
    if (rule.onMatch.banDispositions?.includes(disposition)) {
      throw new Error(
        `Rule ${rule.ruleId} banned disposition ${disposition} without a remaining allowed target`,
      );
    }
    if (rule.onMatch.injectImmediateActions) {
      immediateActions.push(...rule.onMatch.injectImmediateActions);
    }
    if (rule.onMatch.injectClinicalFlags) {
      clinicalFlags.push(...rule.onMatch.injectClinicalFlags);
    }
    if (rule.onMatch.injectPointOfCareChecklist) {
      pointOfCareChecklist.push(...rule.onMatch.injectPointOfCareChecklist);
    }
  }

  return {
    ...result,
    disposition,
    immediateActions: cappedUnique(immediateActions, 5),
    clinicalFlags: uniqueStrings(clinicalFlags),
    pointOfCareChecklist: cappedUnique(pointOfCareChecklist, 6),
  };
}

export const ClinicalPolicyEngine = {
  evaluatePreInference(encounter: EncounterInput): PreInferenceEvaluation {
    const { matches, rules } = collectMatches("pre_inference", encounter, null);
    const diverted = rules.some((rule) => rule.onMatch.divertEmergency === true);
    const injectedClinicalFlags = uniqueStrings(
      rules.flatMap((rule) => rule.onMatch.injectClinicalFlags ?? []),
    );

    return {
      diverted,
      disposition: diverted ? "emergency" : null,
      matchedRules: matches,
      policyVersions: uniqueStrings(matches.map((match) => match.policyVersion)),
      matchedRuleIds: matches.map((match) => match.ruleId),
      clinicalSourceIds: uniqueStrings(matches.map((match) => match.sourceId)),
      clinicalReviewStatus: reviewStatusFromMatches(matches),
      injectedClinicalFlags,
    };
  },

  evaluatePostInference(
    triageResult: TriageResult,
    encounter: EncounterInput,
  ): PostInferenceEvaluation {
    const { matches, rules } = collectMatches(
      "post_inference",
      encounter,
      triageResult,
    );
    const result = applyPostMatch(triageResult, rules);

    return {
      overridden: result.disposition !== triageResult.disposition,
      result,
      matchedRules: matches,
      policyVersions: uniqueStrings(matches.map((match) => match.policyVersion)),
      matchedRuleIds: matches.map((match) => match.ruleId),
      clinicalSourceIds: uniqueStrings(matches.map((match) => match.sourceId)),
      clinicalReviewStatus: reviewStatusFromMatches(matches),
    };
  },
};
