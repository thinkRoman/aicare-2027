import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createUserSessionToken,
  userIdFromEmail,
  verifyUserSessionToken,
  buildUserSessionCookieOptions,
  USER_SESSION_MAX_AGE_SECONDS,
} from "@/lib/security/auth";
import { stripCommonPii } from "@/lib/security/pii";
import { getRateLimitReadiness } from "@/lib/security/rateLimitReadiness";
import {
  isEmailIntegrationActive,
  isWhatsAppIntegrationActive,
} from "@/lib/integrations/messagingReadiness";
import {
  R2_DOWNLOAD_TTL_SECONDS,
  R2_IMAGE_RETENTION_DAYS,
  R2_UPLOAD_TTL_SECONDS,
} from "@/lib/storage/r2";
import {
  NATIVE_PLATFORM_FOLDERS_COMMITTED,
  NATIVE_PLATFORM_REPRODUCTION,
} from "@/lib/mobile/nativePackaging";
import {
  assertCapacitorServerUrlSafeForProduction,
  resolveCapacitorServerUrl,
} from "@/lib/mobile/capacitorServerUrl";
import { FORBIDDEN_DEVICE_SECRET_STORES } from "@/lib/mobile/capacitor";
import { UNKNOWN_EMERGENCY_ACTION } from "@/lib/utils/EmergencyNumberResolver";
import { postInferenceArbiter } from "@/services/ai/arbiter/postInferenceArbiter";
import { preInferenceArbiter } from "@/services/ai/arbiter/preInferenceArbiter";
import type { EncounterInput } from "@/lib/schemas/encounter";
import type { TriageResult } from "@/lib/schemas/triage";
import {
  runTriagePipeline,
  type EncounterPersistence,
  type PersistedEncounterRecord,
} from "@/services/triage/runTriagePipeline";
import type { IAIProviderAdapter } from "@/services/ai/adapters/IAIProviderAdapter";
import { BYOK_FAILURE_MESSAGE, BYOKExecutionError } from "@/services/ai/errors";

const VALID_SECRET =
  "gate6-test-secret-with-at-least-32-characters-long";

function baseEncounter(
  overrides: Partial<EncounterInput> = {},
): EncounterInput {
  return {
    chiefComplaint: overrides.chiefComplaint ?? "mild cough for two days",
    patientContext: {
      ageGroup: "adult",
      activeMedications: [],
      knownAllergies: [],
      ...overrides.patientContext,
    },
    anamnesis: overrides.anamnesis ?? {},
    image: overrides.image,
  };
}

function routineResult(overrides: Partial<TriageResult> = {}): TriageResult {
  return {
    disposition: "routine",
    rationale: "Candidate routine disposition for Gate 6 regression only.",
    plainEnglishSummary: "This is a candidate summary for Gate 6 regression only.",
    immediateActions: ["Rest and reassess if symptoms change."],
    redFlagsToMonitor: ["Worsening symptoms that concern you."],
    pointOfCareChecklist: ["Share the timeline of symptoms with a clinician."],
    confidenceScore: 0.4,
    clinicalFlags: [],
    ...overrides,
  };
}

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

describe("Gate 6 security and identity", () => {
  const previousSecret = process.env.NEXTAUTH_SECRET;

  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = VALID_SECRET;
  });

  afterEach(() => {
    if (previousSecret === undefined) {
      delete process.env.NEXTAUTH_SECRET;
    } else {
      process.env.NEXTAUTH_SECRET = previousSecret;
    }
  });

  it("signs sessions and re-derives userId from email only", () => {
    const email = "person@example.com";
    const forgedUserId = "client-forged-user-id-xxxxxxxx";
    const token = createUserSessionToken({
      userId: forgedUserId,
      email,
    });
    const verified = verifyUserSessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.email).toBe(email);
    expect(verified?.userId).toBe(userIdFromEmail(email));
    expect(verified?.userId).not.toBe(forgedUserId);
  });

  it("requires a strong NEXTAUTH_SECRET and sets secure cookie flags", () => {
    delete process.env.NEXTAUTH_SECRET;
    expect(() =>
      createUserSessionToken({
        userId: "x",
        email: "a@b.com",
      }),
    ).toThrow(/NEXTAUTH_SECRET/);

    process.env.NEXTAUTH_SECRET = VALID_SECRET;
    const production = buildUserSessionCookieOptions("production");
    expect(production).toEqual({
      httpOnly: true,
      sameSite: "strict",
      secure: true,
      path: "/",
      maxAge: USER_SESSION_MAX_AGE_SECONDS,
    });
  });
});

describe("Gate 6 privacy and retention constants", () => {
  it("documents best-effort PII stripping before AI", () => {
    const stripped = stripCommonPii(
      "Call me at 415-555-0100 or jane@example.com",
    );
    expect(stripped).toContain("[REDACTED_PHONE]");
    expect(stripped).toContain("[REDACTED_EMAIL]");
    expect(stripped).not.toContain("jane@example.com");
  });

  it("keeps private R2 URL TTLs and retention policy constants", () => {
    expect(R2_UPLOAD_TTL_SECONDS).toBe(300);
    expect(R2_DOWNLOAD_TTL_SECONDS).toBe(900);
    expect(R2_IMAGE_RETENTION_DAYS).toBe(30);
  });

  it("keeps email and WhatsApp inactive without explicit authorization", () => {
    expect(
      isEmailIntegrationActive({
        RESEND_API_KEY: "re_test",
        EMAIL_SENT_FROM: "ops@example.com",
      }),
    ).toBe(false);
    expect(
      isWhatsAppIntegrationActive({
        WHATSAPP_PHONE_NUMBER_ID: "123",
        WHATSAPP_ACCESS_TOKEN: "token",
      }),
    ).toBe(false);
    expect(
      isEmailIntegrationActive({
        EMAIL_INTEGRATION_AUTHORIZED: "true",
        RESEND_API_KEY: "re_test",
        EMAIL_SENT_FROM: "ops@example.com",
      }),
    ).toBe(true);
  });

  it("forbids health/secret storage in device stores", () => {
    expect(FORBIDDEN_DEVICE_SECRET_STORES).toEqual(
      expect.arrayContaining(["Preferences", "localStorage", "sessionStorage"]),
    );
  });
});

describe("Gate 6 clinical regression additions", () => {
  it("does not treat missing clinical information as a negative finding", () => {
    const encounter = baseEncounter({
      chiefComplaint: "feeling unwell",
      patientContext: {
        ageGroup: "adult",
        activeMedications: [],
        knownAllergies: [],
      },
    });
    const pre = preInferenceArbiter(encounter);
    expect(pre.diverted).toBe(false);
  });

  it("escalates disposition inconsistencies safely", () => {
    const evaluation = postInferenceArbiter(
      routineResult({
        disposition: "self_care",
        rationale:
          "Candidate noted an emergency red flag but still suggested self-care.",
        plainEnglishSummary:
          "High-concern symptoms appear present while disposition is self-care.",
      }),
      baseEncounter({
        chiefComplaint: "sudden facial droop and arm weakness",
      }),
    );
    expect(evaluation.matchedRuleIds).toContain(
      "emergency.v1.inconsistency_escalation",
    );
    expect(evaluation.result.disposition).not.toBe("self_care");
    expect(evaluation.result.disposition).not.toBe("routine");
  });
});

describe("Gate 6 AI path and malformed output", () => {
  it("never persists or reassures on malformed model output", async () => {
    const { persist, saves } = memoryPersist();
    const adapter: IAIProviderAdapter = {
      provider: "openai",
      model: "platform-model",
      async generateTriage() {
        return { hello: "world" } as unknown as TriageResult;
      },
    };

    const result = await runTriagePipeline(
      {
        consentAcknowledged: true,
        ...baseEncounter(),
      },
      {
        identity: { deviceId: "device-1", userId: null },
        persist,
        resolveAdapter: async () => adapter,
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("MALFORMED_MODEL_OUTPUT");
    }
    expect(saves).toHaveLength(0);
    expect(JSON.stringify(result).toLowerCase()).not.toContain("feel fine");
  });

  it("never falls back to platform AI on BYOK failure", async () => {
    const { persist, saves } = memoryPersist();
    const platformFactory = vi.fn(() => ({
      provider: "openai" as const,
      model: "gpt-platform-default",
      generateTriage: async () => routineResult(),
    }));

    const result = await runTriagePipeline(
      {
        consentAcknowledged: true,
        ...baseEncounter(),
      },
      {
        identity: { deviceId: "device-1", userId: "user-1" },
        persist,
        resolveAdapter: async () => ({
          provider: "openai",
          model: "user-byok-model",
          async generateTriage() {
            throw new BYOKExecutionError();
          },
        }),
        aiServiceDeps: { createOpenAIAdapter: platformFactory },
      },
    );

    expect(result).toEqual({
      ok: false,
      code: "BYOK_EXECUTION_FAILED",
      message: BYOK_FAILURE_MESSAGE,
      retryable: true,
    });
    expect(platformFactory).not.toHaveBeenCalled();
    expect(saves).toHaveLength(0);
  });
});

describe("Gate 6 encounter deletion and ownership", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/lib/db/mongodb");
    vi.doUnmock("@/lib/db/models/Encounter");
  });

  it("deletes private image artifacts and marks the encounter deleted", async () => {
    const deleteObject = vi.fn(async () => ({
      objectKey: "encounters/e1/img.jpg",
      deleted: true as const,
    }));
    const findOneAndUpdate = vi.fn(async () => ({ status: "deleted" }));

    vi.doMock("@/lib/db/mongodb", () => ({
      connectToDatabase: vi.fn(async () => undefined),
    }));
    vi.doMock("@/lib/db/models/Encounter", () => ({
      Encounter: {
        findOne: vi.fn(() => ({
          lean: async () => ({
            encounterId: "e1",
            deviceId: "device-1",
            userId: null,
            status: "triaged",
            image: { objectKey: "encounters/e1/img.jpg" },
          }),
        })),
        findOneAndUpdate,
      },
    }));

    const { deleteEncounterWithArtifacts } = await import(
      "@/services/triage/deleteEncounter"
    );

    const result = await deleteEncounterWithArtifacts(
      "e1",
      { deviceId: "device-1", userId: null },
      { deleteObject },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("deleted");
      expect(result.imageDeleted).toBe(true);
    }
    expect(deleteObject).toHaveBeenCalledWith({
      objectKey: "encounters/e1/img.jpg",
    });
    expect(findOneAndUpdate).toHaveBeenCalled();
  });

  it("rejects ownership mismatches without deleting images", async () => {
    const deleteObject = vi.fn(async () => ({
      objectKey: "encounters/e1/img.jpg",
      deleted: true as const,
    }));

    vi.doMock("@/lib/db/mongodb", () => ({
      connectToDatabase: vi.fn(async () => undefined),
    }));
    vi.doMock("@/lib/db/models/Encounter", () => ({
      Encounter: {
        findOne: vi.fn(() => ({
          lean: async () => ({
            encounterId: "e1",
            deviceId: "device-owner",
            userId: "user-owner",
            status: "triaged",
            image: { objectKey: "encounters/e1/img.jpg" },
          }),
        })),
        findOneAndUpdate: vi.fn(),
      },
    }));

    const { deleteEncounterWithArtifacts } = await import(
      "@/services/triage/deleteEncounter"
    );

    const result = await deleteEncounterWithArtifacts(
      "e1",
      { deviceId: "device-other", userId: "user-other" },
      { deleteObject },
    );

    expect(result).toEqual({
      ok: false,
      code: "FORBIDDEN",
      message: "Not authorized for this encounter",
    });
    expect(deleteObject).not.toHaveBeenCalled();
  });
});

describe("Gate 6 API abuse protection readiness", () => {
  it("reports Redis rate limiting as an explicit release blocker", () => {
    const readiness = getRateLimitReadiness({});
    expect(readiness.configured).toBe(false);
    expect(readiness.releaseBlocker).toBe(true);
    expect(readiness.status).toBe("NOT_CONFIGURED");
    expect(readiness.message).toMatch(/rate limiting/i);
  });
});

describe("Gate 6 Capacitor packaging decisions", () => {
  it("keeps native folders gitignored with a documented reproduction path", () => {
    expect(NATIVE_PLATFORM_FOLDERS_COMMITTED).toBe(false);
    expect(NATIVE_PLATFORM_REPRODUCTION.length).toBeGreaterThan(0);
  });

  it("rejects localhost CAPACITOR_SERVER_URL in production", () => {
    expect(() =>
      assertCapacitorServerUrlSafeForProduction(
        "http://localhost:3000",
        "production",
      ),
    ).toThrow(/localhost|https/i);
    expect(
      resolveCapacitorServerUrl({
        CAPACITOR_SERVER_URL: "https://app.example.com",
      }),
    ).toBe("https://app.example.com");
    expect(() =>
      assertCapacitorServerUrlSafeForProduction(
        "https://app.example.com",
        "production",
      ),
    ).not.toThrow();
  });

  it("preserves unknown-locale emergency copy", () => {
    expect(UNKNOWN_EMERGENCY_ACTION).toBe("Call Local Emergency Services");
  });
});
