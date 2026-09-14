import { describe, expect, it, vi } from "vitest";
import type { EncounterInput } from "@/lib/schemas/encounter";
import type { TriageResult } from "@/lib/schemas/triage";
import type { IAIProviderAdapter } from "@/services/ai/adapters/IAIProviderAdapter";
import {
  AIResponseValidationError,
  BYOKExecutionError,
  BYOK_FAILURE_MESSAGE,
} from "@/services/ai/errors";
import { postInferenceArbiter } from "@/services/ai/arbiter/postInferenceArbiter";
import {
  runTriagePipeline,
  type EncounterPersistence,
  type PersistedEncounterRecord,
} from "@/services/triage/runTriagePipeline";

const baseRequest = {
  consentAcknowledged: true as const,
  chiefComplaint: "mild cough for two days",
  patientContext: {
    ageGroup: "adult" as const,
    activeMedications: [],
    knownAllergies: [],
  },
  anamnesis: {},
  locale: "en-US",
};

const validTriage: TriageResult = {
  disposition: "routine",
  rationale: "Candidate routine disposition for pipeline testing only.",
  plainEnglishSummary: "This is a candidate summary for pipeline testing only.",
  immediateActions: ["Rest and reassess if symptoms change."],
  redFlagsToMonitor: ["Worsening symptoms that concern you."],
  pointOfCareChecklist: ["Share the timeline of symptoms with a clinician."],
  confidenceScore: 0.4,
  clinicalFlags: [],
};

function memoryPersist() {
  const saves: PersistedEncounterRecord[] = [];
  const persist: EncounterPersistence = {
    async save(record) {
      const stored = {
        encounterId: record.encounterId,
        status: record.status,
        deviceId: record.deviceId,
        userId: record.userId,
        chiefComplaint: record.chiefComplaint,
        triageResult: record.triageResult,
        auditProvenance: record.auditProvenance,
      };
      saves.push(stored);
      return stored;
    },
  };
  return { persist, saves };
}

describe("Gate 4 triage safety pipeline", () => {
  it("diverts pre-inference emergencies without invoking AI and persists diverted_emergency", async () => {
    const { persist, saves } = memoryPersist();
    const resolveAdapter = vi.fn(async () => {
      throw new Error("AI must not be called");
    });

    const result = await runTriagePipeline(
      {
        ...baseRequest,
        chiefComplaint: "sudden crushing chest pain radiating to my left arm",
      },
      {
        identity: { deviceId: "device-1", userId: null },
        locale: "en-US",
        persist,
        resolveAdapter,
      },
    );

    expect(resolveAdapter).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (result.ok && result.status === "diverted_emergency") {
      expect(result.emergency.action).toBe("Call 911");
      expect(result.emergency.action).not.toMatch(/112|999/);
      expect(result.matchedRuleIds.length).toBeGreaterThan(0);
    }
    expect(saves).toHaveLength(1);
    expect(saves[0]?.status).toBe("diverted_emergency");
    expect(saves[0]?.triageResult).toBeUndefined();
  });

  it("strips common PII before AI invocation", async () => {
    const { persist } = memoryPersist();
    let seen: EncounterInput | undefined;
    const adapter: IAIProviderAdapter = {
      provider: "openai",
      model: "test-model",
      async generateTriage(payload) {
        seen = payload;
        return validTriage;
      },
    };

    await runTriagePipeline(
      {
        ...baseRequest,
        chiefComplaint:
          "I have a cough. Email jane@example.com phone 415-555-0100",
      },
      {
        identity: { deviceId: "device-1", userId: null },
        persist,
        resolveAdapter: async () => adapter,
      },
    );

    expect(seen).toBeDefined();
    expect(seen?.chiefComplaint).toContain("[REDACTED_EMAIL]");
    expect(seen?.chiefComplaint).toContain("[REDACTED_PHONE]");
    expect(seen?.chiefComplaint).not.toContain("jane@example.com");
  });

  it("halts malformed AI output before post-inference and does not persist a triage result", async () => {
    const { persist, saves } = memoryPersist();
    const runPostInference = vi.fn(postInferenceArbiter);
    const adapter: IAIProviderAdapter = {
      provider: "openai",
      model: "test-model",
      async generateTriage() {
        return { disposition: "routine" } as unknown as TriageResult;
      },
    };

    const result = await runTriagePipeline(baseRequest, {
      identity: { deviceId: "device-1", userId: null },
      persist,
      resolveAdapter: async () => adapter,
      runPostInference,
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        code: "MALFORMED_MODEL_OUTPUT",
        retryable: true,
      }),
    );
    expect(runPostInference).not.toHaveBeenCalled();
    expect(saves).toHaveLength(0);
    if (!result.ok) {
      expect(JSON.stringify(result).toLowerCase()).not.toContain("feel fine");
      expect(JSON.stringify(result)).not.toContain("disposition");
    }
  });

  it("treats adapter validation failures as safe retry without post-arbiter", async () => {
    const { persist, saves } = memoryPersist();
    const runPostInference = vi.fn(postInferenceArbiter);
    const adapter: IAIProviderAdapter = {
      provider: "openai",
      model: "test-model",
      async generateTriage() {
        throw new AIResponseValidationError("bad json");
      },
    };

    const result = await runTriagePipeline(baseRequest, {
      identity: { deviceId: "device-1", userId: null },
      persist,
      resolveAdapter: async () => adapter,
      runPostInference,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("MALFORMED_MODEL_OUTPUT");
    }
    expect(runPostInference).not.toHaveBeenCalled();
    expect(saves).toHaveLength(0);
  });

  it("runs post-inference arbiter and persists only validated results", async () => {
    const { persist, saves } = memoryPersist();
    const runPostInference = vi.fn(postInferenceArbiter);
    const adapter: IAIProviderAdapter = {
      provider: "openai",
      model: "test-model",
      async generateTriage() {
        return validTriage;
      },
    };

    const result = await runTriagePipeline(baseRequest, {
      identity: { deviceId: "device-1", userId: null },
      persist,
      resolveAdapter: async () => adapter,
      runPostInference,
    });

    expect(runPostInference).toHaveBeenCalledOnce();
    expect(result.ok).toBe(true);
    if (result.ok && result.status === "triaged") {
      expect(result.triageResult.disposition).toBe("routine");
    }
    expect(saves).toHaveLength(1);
    expect(saves[0]?.status).toBe("triaged");
    expect(saves[0]?.triageResult?.disposition).toBe("routine");
    expect(saves[0]?.auditProvenance.aiProviderUsed).toBe("openai");
    expect(saves[0]?.auditProvenance.modelUsed).toBe("test-model");
  });

  it("returns BYOKExecutionError message and never invokes platform adapter", async () => {
    const { persist, saves } = memoryPersist();
    const platformAdapter = vi.fn();
    const adapter: IAIProviderAdapter = {
      provider: "anthropic",
      model: "user-model",
      async generateTriage() {
        throw new BYOKExecutionError();
      },
    };

    const result = await runTriagePipeline(baseRequest, {
      identity: { deviceId: "device-1", userId: "user-1" },
      persist,
      resolveAdapter: async () => adapter,
      aiServiceDeps: {
        createOpenAIAdapter: platformAdapter,
      },
    });

    expect(result).toEqual({
      ok: false,
      code: "BYOK_EXECUTION_FAILED",
      message: BYOK_FAILURE_MESSAGE,
      retryable: true,
    });
    expect(platformAdapter).not.toHaveBeenCalled();
    expect(saves).toHaveLength(0);
  });
});
