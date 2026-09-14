import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { EncounterInput } from "@/lib/schemas/encounter";
import { EncounterInputSchema } from "@/lib/schemas/encounter";
import {
  TriageResultSchema,
  type TriageResult,
} from "@/lib/schemas/triage";
import { stripCommonPii } from "@/lib/security/pii";
import type { RequestIdentity } from "@/lib/security/identity";
import {
  resolveEmergencyAction,
  type EmergencyResolution,
} from "@/lib/utils/EmergencyNumberResolver";
import { preInferenceArbiter } from "@/services/ai/arbiter/preInferenceArbiter";
import { postInferenceArbiter } from "@/services/ai/arbiter/postInferenceArbiter";
import { AIService, type AIServiceDependencies } from "@/services/ai/AIService";
import type { IAIProviderAdapter } from "@/services/ai/adapters/IAIProviderAdapter";
import {
  AIResponseValidationError,
  BYOKExecutionError,
  BYOK_FAILURE_MESSAGE,
  isAiError,
} from "@/services/ai/errors";

export const TriageRequestSchema = EncounterInputSchema.extend({
  consentAcknowledged: z.literal(true),
  /** Trusted locale from the client Accept-Language binding only — never free text. */
  locale: z.string().trim().min(2).max(32).optional(),
});

export type TriageRequest = z.infer<typeof TriageRequestSchema>;

export type PersistedEncounterRecord = {
  encounterId: string;
  status: "in-progress" | "triaged" | "diverted_emergency" | "deleted";
  deviceId: string;
  userId?: string;
  chiefComplaint: string;
  triageResult?: TriageResult & { overriddenBySafetyArbiter: boolean };
  auditProvenance: {
    policyVersions: string[];
    matchedRuleIds: string[];
    clinicalSourceIds: string[];
    clinicalReviewStatus: "verified" | "pending_clinical_review";
    preflightTriggered: boolean;
    postflightTriggered: boolean;
    aiProviderUsed?: string;
    modelUsed?: string;
    latencyMs?: number;
  };
};

export type EncounterPersistence = {
  save(record: PersistedEncounterRecord & {
    schemaVersion: string;
    consentAcknowledgedAt: Date;
    patientContext: EncounterInput["patientContext"];
    anamnesis: EncounterInput["anamnesis"];
    image?: EncounterInput["image"];
  }): Promise<PersistedEncounterRecord>;
};

export type TriagePipelineDependencies = {
  identity: RequestIdentity;
  locale?: string | null;
  persist: EncounterPersistence;
  aiServiceDeps?: AIServiceDependencies;
  resolveAdapter?: (
    userId: string | null,
  ) => Promise<IAIProviderAdapter>;
  runPreInference?: typeof preInferenceArbiter;
  runPostInference?: typeof postInferenceArbiter;
  resolveEmergency?: typeof resolveEmergencyAction;
  now?: () => number;
};

export type TriageSuccessResponse = {
  ok: true;
  encounterId: string;
  status: "triaged";
  triageResult: TriageResult & { overriddenBySafetyArbiter: boolean };
  audit: PersistedEncounterRecord["auditProvenance"];
};

export type TriageEmergencyResponse = {
  ok: true;
  encounterId: string;
  status: "diverted_emergency";
  emergency: EmergencyResolution;
  matchedRuleIds: string[];
};

export type TriageSafeRetryResponse = {
  ok: false;
  code: "MALFORMED_MODEL_OUTPUT" | "BYOK_EXECUTION_FAILED" | "AI_FAILURE";
  message: string;
  retryable: true;
};

export type TriagePipelineResult =
  | TriageSuccessResponse
  | TriageEmergencyResponse
  | TriageSafeRetryResponse;

function buildEncounterInput(request: TriageRequest): EncounterInput {
  const scrubbedComplaint = stripCommonPii(request.chiefComplaint);
  return {
    chiefComplaint: scrubbedComplaint,
    patientContext: request.patientContext,
    anamnesis: request.anamnesis,
    image: request.image,
  };
}

/**
 * Gate 4 triage safety pipeline. Injectable boundaries keep unit/adversarial
 * tests free of live MongoDB, R2, and provider networks.
 */
export async function runTriagePipeline(
  request: TriageRequest,
  dependencies: TriagePipelineDependencies,
): Promise<TriagePipelineResult> {
  const runPre = dependencies.runPreInference ?? preInferenceArbiter;
  const runPost = dependencies.runPostInference ?? postInferenceArbiter;
  const resolveEmergency =
    dependencies.resolveEmergency ?? resolveEmergencyAction;
  const now = dependencies.now ?? Date.now;

  const encounterInput = buildEncounterInput(request);
  const encounterId = randomUUID();
  const startedAt = now();

  const pre = runPre(encounterInput);
  if (pre.diverted) {
    const emergency = resolveEmergency(dependencies.locale);
    await dependencies.persist.save({
      encounterId,
      schemaVersion: "1",
      status: "diverted_emergency",
      deviceId: dependencies.identity.deviceId,
      userId: dependencies.identity.userId ?? undefined,
      consentAcknowledgedAt: new Date(),
      patientContext: encounterInput.patientContext,
      chiefComplaint: encounterInput.chiefComplaint,
      anamnesis: encounterInput.anamnesis,
      image: encounterInput.image,
      auditProvenance: {
        policyVersions: pre.policyVersions,
        matchedRuleIds: pre.matchedRuleIds,
        clinicalSourceIds: pre.clinicalSourceIds,
        clinicalReviewStatus: pre.clinicalReviewStatus,
        preflightTriggered: true,
        postflightTriggered: false,
        latencyMs: now() - startedAt,
      },
    });

    return {
      ok: true,
      encounterId,
      status: "diverted_emergency",
      emergency,
      matchedRuleIds: pre.matchedRuleIds,
    };
  }

  const resolveAdapter =
    dependencies.resolveAdapter ??
    ((userId: string | null) =>
      AIService.forUser(userId, dependencies.aiServiceDeps));

  let adapter: IAIProviderAdapter;
  try {
    adapter = await resolveAdapter(dependencies.identity.userId);
  } catch (error) {
    if (error instanceof BYOKExecutionError) {
      return {
        ok: false,
        code: "BYOK_EXECUTION_FAILED",
        message: BYOK_FAILURE_MESSAGE,
        retryable: true,
      };
    }
    return {
      ok: false,
      code: "AI_FAILURE",
      message: isAiError(error)
        ? error.message
        : "AI provider could not be resolved",
      retryable: true,
    };
  }

  let rawOutput: unknown;
  try {
    rawOutput = await adapter.generateTriage(encounterInput);
  } catch (error) {
    if (error instanceof BYOKExecutionError) {
      return {
        ok: false,
        code: "BYOK_EXECUTION_FAILED",
        message: BYOK_FAILURE_MESSAGE,
        retryable: true,
      };
    }
    if (error instanceof AIResponseValidationError) {
      return {
        ok: false,
        code: "MALFORMED_MODEL_OUTPUT",
        message:
          "The guidance service returned an unusable response. Please retry. No triage result was produced.",
        retryable: true,
      };
    }
    return {
      ok: false,
      code: "AI_FAILURE",
      message: isAiError(error)
        ? error.message
        : "AI provider failed. Please retry.",
      retryable: true,
    };
  }

  // Boundary: treat provider output as unknown until schema validation passes.
  const validated = TriageResultSchema.safeParse(rawOutput);
  if (!validated.success) {
    return {
      ok: false,
      code: "MALFORMED_MODEL_OUTPUT",
      message:
        "The guidance service returned an unusable response. Please retry. No triage result was produced.",
      retryable: true,
    };
  }

  const post = runPost(validated.data, encounterInput);
  const latencyMs = now() - startedAt;

  const triageResult = {
    ...post.result,
    overriddenBySafetyArbiter: post.overridden,
  };

  await dependencies.persist.save({
    encounterId,
    schemaVersion: "1",
    status: "triaged",
    deviceId: dependencies.identity.deviceId,
    userId: dependencies.identity.userId ?? undefined,
    consentAcknowledgedAt: new Date(),
    patientContext: encounterInput.patientContext,
    chiefComplaint: encounterInput.chiefComplaint,
    anamnesis: encounterInput.anamnesis,
    image: encounterInput.image,
    triageResult,
    auditProvenance: {
      policyVersions: [...pre.policyVersions, ...post.policyVersions],
      matchedRuleIds: [...pre.matchedRuleIds, ...post.matchedRuleIds],
      clinicalSourceIds: [
        ...pre.clinicalSourceIds,
        ...post.clinicalSourceIds,
      ],
      clinicalReviewStatus:
        pre.clinicalReviewStatus === "verified" &&
        post.clinicalReviewStatus === "verified"
          ? "verified"
          : "pending_clinical_review",
      preflightTriggered: false,
      postflightTriggered: post.matchedRuleIds.length > 0 || post.overridden,
      aiProviderUsed: adapter.provider,
      modelUsed: adapter.model,
      latencyMs,
    },
  });

  return {
    ok: true,
    encounterId,
    status: "triaged",
    triageResult,
    audit: {
      policyVersions: [...pre.policyVersions, ...post.policyVersions],
      matchedRuleIds: [...pre.matchedRuleIds, ...post.matchedRuleIds],
      clinicalSourceIds: [
        ...pre.clinicalSourceIds,
        ...post.clinicalSourceIds,
      ],
      clinicalReviewStatus:
        pre.clinicalReviewStatus === "verified" &&
        post.clinicalReviewStatus === "verified"
          ? "verified"
          : "pending_clinical_review",
      preflightTriggered: false,
      postflightTriggered: post.matchedRuleIds.length > 0 || post.overridden,
      aiProviderUsed: adapter.provider,
      modelUsed: adapter.model,
      latencyMs,
    },
  };
}
