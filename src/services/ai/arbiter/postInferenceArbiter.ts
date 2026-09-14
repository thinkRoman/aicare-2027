import {
  ClinicalPolicyEngine,
  type PostInferenceEvaluation,
} from "@/clinical/engine/ClinicalPolicyEngine";
import type { EncounterInput } from "@/lib/schemas/encounter";
import type { TriageResult } from "@/lib/schemas/triage";

export function postInferenceArbiter(
  triageResult: TriageResult,
  encounter: EncounterInput,
): PostInferenceEvaluation {
  return ClinicalPolicyEngine.evaluatePostInference(triageResult, encounter);
}
