import { describe, expect, it } from "vitest";
import { Encounter } from "@/lib/db/models/Encounter";
import { UserAiConfig } from "@/lib/db/models/UserAiConfig";
import { encryptSecret } from "@/lib/security/crypto";

const VALID_TEST_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function validEncounterInput() {
  return {
    encounterId: "enc_test_001",
    deviceId: "11111111-2222-4333-a444-555555555555",
    schemaVersion: "1",
    status: "in-progress" as const,
    consentAcknowledgedAt: new Date("2026-09-14T00:00:00.000Z"),
    patientContext: {
      ageGroup: "adult" as const,
      activeMedications: [],
      knownAllergies: [],
      feverIndicated: false,
    },
    chiefComplaint: "mild cough for two days",
    anamnesis: {
      onset: "two days ago",
      severity: 3,
    },
    auditProvenance: {
      policyVersions: [],
      matchedRuleIds: [],
      clinicalSourceIds: [],
      clinicalReviewStatus: "pending_clinical_review" as const,
      preflightTriggered: false,
      postflightTriggered: false,
    },
  };
}

describe("Encounter model validation", () => {
  it("accepts a complete encounter with private R2 object key metadata", async () => {
    const doc = new Encounter({
      ...validEncounterInput(),
      image: {
        objectKey: "encounters/enc_test_001/abc123.jpg",
        contentType: "image/jpeg",
        capturedAt: new Date("2026-09-14T00:00:00.000Z"),
        quality: { acceptable: true, issues: [] },
      },
      triageResult: {
        disposition: "routine",
        rationale: "Candidate routine disposition for validation testing.",
        plainEnglishSummary: "This is a candidate summary for validation testing.",
        immediateActions: ["Rest and reassess if symptoms change."],
        redFlagsToMonitor: ["Worsening symptoms that concern you."],
        pointOfCareChecklist: ["Share the timeline of symptoms with a clinician."],
        confidenceScore: 0.5,
        clinicalFlags: [],
        overriddenBySafetyArbiter: false,
      },
    });

    await expect(doc.validate()).resolves.toBeUndefined();
  });

  it("rejects public image URLs in objectKey", async () => {
    const doc = new Encounter({
      ...validEncounterInput(),
      image: {
        objectKey: "https://cdn.example.com/public.jpg",
        contentType: "image/jpeg",
        capturedAt: new Date("2026-09-14T00:00:00.000Z"),
        quality: { acceptable: true, issues: [] },
      },
    });

    await expect(doc.validate()).rejects.toThrow(/objectKey|URL/i);
  });

  it("rejects invalid encounter statuses", async () => {
    const doc = new Encounter({
      ...validEncounterInput(),
      status: "diagnosed",
    });

    await expect(doc.validate()).rejects.toThrow();
  });
});

describe("UserAiConfig model validation", () => {
  it("rejects plaintext API key persistence", async () => {
    const doc = new UserAiConfig({
      userId: "user_1",
      provider: "openai",
      encryptedCredential: "sk-plaintext-secret-value",
      keyLast4: "alue",
      selectedModel: "configured-by-user",
    });

    await expect(doc.validate()).rejects.toThrow(/encryptedCredential|ciphertext/i);
  });

  it("accepts AES-256-GCM ciphertext credentials only", async () => {
    const previous = process.env.BYOK_ENCRYPTION_KEY;
    process.env.BYOK_ENCRYPTION_KEY = VALID_TEST_KEY;

    try {
      const ciphertext = encryptSecret("sk-example-not-for-production");
      const doc = new UserAiConfig({
        userId: "user_2",
        provider: "anthropic",
        encryptedCredential: ciphertext,
        keyLast4: "tion",
        selectedModel: "configured-by-user",
      });

      await expect(doc.validate()).resolves.toBeUndefined();
      expect(doc.encryptedCredential).toContain(":");
      expect(doc.encryptedCredential).not.toContain("sk-example");
    } finally {
      if (previous === undefined) {
        delete process.env.BYOK_ENCRYPTION_KEY;
      } else {
        process.env.BYOK_ENCRYPTION_KEY = previous;
      }
    }
  });

  it("requires selectedModel without baking in a default model identifier", async () => {
    const doc = new UserAiConfig({
      userId: "user_3",
      provider: "local",
      selectedModel: "",
    });

    await expect(doc.validate()).rejects.toThrow();
  });
});
