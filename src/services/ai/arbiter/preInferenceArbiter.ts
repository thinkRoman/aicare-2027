import {
  ClinicalPolicyEngine,
  type PreInferenceEvaluation,
} from "@/clinical/engine/ClinicalPolicyEngine";
import type { EncounterInput } from "@/lib/schemas/encounter";

export function preInferenceArbiter(
  encounter: EncounterInput,
): PreInferenceEvaluation {
  return ClinicalPolicyEngine.evaluatePreInference(encounter);
}
