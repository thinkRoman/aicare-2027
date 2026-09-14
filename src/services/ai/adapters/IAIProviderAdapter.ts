import type { EncounterInput } from "@/lib/schemas/encounter";
import type { TriageResult } from "@/lib/schemas/triage";

/**
 * Provider-independent adapter contract.
 * Clinical policy evaluation is out of scope for adapters (Gate 4 pipeline).
 */
export interface IAIProviderAdapter {
  readonly provider: string;
  readonly model: string;
  readonly baseUrl?: string;

  generateTriage(payload: EncounterInput): Promise<TriageResult>;
}
