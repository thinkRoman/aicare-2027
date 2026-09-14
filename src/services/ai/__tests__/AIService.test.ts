import { afterEach, describe, expect, it, vi } from "vitest";
import type { EncounterInput } from "@/lib/schemas/encounter";
import type { TriageResult } from "@/lib/schemas/triage";
import { AIService, type ByokRecord } from "@/services/ai/AIService";
import type { IAIProviderAdapter } from "@/services/ai/adapters/IAIProviderAdapter";
import {
  AIConfigurationError,
  AIProviderError,
  BYOK_FAILURE_MESSAGE,
  BYOKConfigurationError,
  BYOKExecutionError,
} from "@/services/ai/errors";

const encounter: EncounterInput = {
  chiefComplaint: "mild cough for two days",
  patientContext: {
    ageGroup: "adult",
    activeMedications: [],
    knownAllergies: [],
  },
  anamnesis: {},
};

const validTriage: TriageResult = {
  disposition: "routine",
  rationale: "Candidate routine disposition for service testing only.",
  plainEnglishSummary: "This is a candidate summary for service testing only.",
  immediateActions: ["Rest and reassess if symptoms change."],
  redFlagsToMonitor: ["Worsening symptoms that concern you."],
  pointOfCareChecklist: ["Share the timeline of symptoms with a clinician."],
  confidenceScore: 0.4,
  clinicalFlags: [],
};

function stubAdapter(
  overrides: Partial<IAIProviderAdapter> & {
    generateTriage?: IAIProviderAdapter["generateTriage"];
  } = {},
): IAIProviderAdapter {
  return {
    provider: overrides.provider ?? "openai",
    model: overrides.model ?? "platform-model",
    baseUrl: overrides.baseUrl,
    generateTriage:
      overrides.generateTriage ?? (async () => validTriage),
  };
}

describe("AIService", () => {
  const previous = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    AI_MODEL: process.env.AI_MODEL,
    LOCAL_AI_BASE_URL: process.env.LOCAL_AI_BASE_URL,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("selects platform OpenAI for anonymous users", async () => {
    process.env.OPENAI_API_KEY = "sk-platform";
    process.env.AI_MODEL = "gpt-5.4-mini";

    const createOpenAIAdapter = vi.fn(() =>
      stubAdapter({ provider: "openai", model: "gpt-5.4-mini" }),
    );

    const adapter = await AIService.forUser(null, { createOpenAIAdapter });
    expect(adapter.provider).toBe("openai");
    expect(adapter.model).toBe("gpt-5.4-mini");
    expect(createOpenAIAdapter).toHaveBeenCalledWith({
      apiKey: "sk-platform",
      model: "gpt-5.4-mini",
    });
  });

  it("fails clearly when anonymous platform key is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    process.env.AI_MODEL = "gpt-5.4-mini";
    await expect(AIService.forUser(null)).rejects.toBeInstanceOf(
      AIConfigurationError,
    );
  });

  it("fails clearly when anonymous AI_MODEL is missing", async () => {
    process.env.OPENAI_API_KEY = "sk-platform";
    delete process.env.AI_MODEL;
    await expect(AIService.forUser(null)).rejects.toBeInstanceOf(
      AIConfigurationError,
    );
  });

  it("uses platform OpenAI when the user has no BYOK record", async () => {
    process.env.OPENAI_API_KEY = "sk-platform";
    process.env.AI_MODEL = "gpt-5.4-mini";

    const createOpenAIAdapter = vi.fn(() =>
      stubAdapter({ model: "gpt-5.4-mini" }),
    );

    const adapter = await AIService.forUser("user-1", {
      byokRepository: {
        findActiveByUserId: async () => null,
      },
      createOpenAIAdapter,
    });

    expect(adapter.model).toBe("gpt-5.4-mini");
    expect(createOpenAIAdapter).toHaveBeenCalledOnce();
  });

  it("selects OpenAI BYOK model and credential, ignoring AI_MODEL", async () => {
    process.env.OPENAI_API_KEY = "sk-platform";
    process.env.AI_MODEL = "gpt-5.4-mini";

    const decryptSecret = vi.fn(() => "sk-user-openai");
    const createOpenAIAdapter = vi.fn(() =>
      stubAdapter({ provider: "openai", model: "user-openai-model" }),
    );

    const record: ByokRecord = {
      userId: "user-1",
      provider: "openai",
      selectedModel: "user-openai-model",
      encryptedCredential: "aa:bb:cc",
    };

    const adapter = await AIService.forUser("user-1", {
      byokRepository: { findActiveByUserId: async () => record },
      decryptSecret,
      createOpenAIAdapter,
    });

    expect(adapter.model).toBe("user-openai-model");
    expect(decryptSecret).toHaveBeenCalledWith("aa:bb:cc");
    expect(createOpenAIAdapter).toHaveBeenCalledWith({
      apiKey: "sk-user-openai",
      model: "user-openai-model",
      baseUrl: undefined,
    });
    expect(createOpenAIAdapter).not.toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "sk-platform" }),
    );
  });

  it("selects Anthropic BYOK configuration", async () => {
    process.env.OPENAI_API_KEY = "sk-platform";
    process.env.AI_MODEL = "gpt-5.4-mini";

    const createAnthropicAdapter = vi.fn(() =>
      stubAdapter({ provider: "anthropic", model: "user-claude-model" }),
    );

    const adapter = await AIService.forUser("user-2", {
      byokRepository: {
        findActiveByUserId: async () => ({
          userId: "user-2",
          provider: "anthropic",
          selectedModel: "user-claude-model",
          encryptedCredential: "aa:bb:cc",
        }),
      },
      decryptSecret: () => "sk-ant-user",
      createAnthropicAdapter,
      createOpenAIAdapter: vi.fn(() => {
        throw new Error("platform adapter must not be used");
      }),
    });

    expect(adapter.provider).toBe("anthropic");
    expect(createAnthropicAdapter).toHaveBeenCalledWith({
      apiKey: "sk-ant-user",
      model: "user-claude-model",
    });
  });

  it("selects Local BYOK with LM Studio URL and exact model", async () => {
    process.env.OPENAI_API_KEY = "sk-platform";
    process.env.AI_MODEL = "gpt-5.4-mini";

    const createLocalAdapter = vi.fn(() =>
      stubAdapter({
        provider: "local",
        model: "qwen2.5-custom",
        baseUrl: "http://127.0.0.1:1234/v1",
      }),
    );

    const adapter = await AIService.forUser("user-3", {
      byokRepository: {
        findActiveByUserId: async () => ({
          userId: "user-3",
          provider: "local",
          selectedModel: "qwen2.5-custom",
          encryptedCredential: "aa:bb:cc",
          baseUrl: "http://127.0.0.1:1234/v1",
        }),
      },
      decryptSecret: () => "local-token",
      createLocalAdapter,
    });

    expect(adapter.provider).toBe("local");
    expect(adapter.model).toBe("qwen2.5-custom");
    expect(createLocalAdapter).toHaveBeenCalledWith({
      apiKey: "local-token",
      model: "qwen2.5-custom",
      baseUrl: "http://127.0.0.1:1234/v1",
    });
  });

  it("returns BYOKConfigurationError for invalid BYOK records", async () => {
    await expect(
      AIService.forUser("user-4", {
        byokRepository: {
          findActiveByUserId: async () => ({
            userId: "user-4",
            provider: "openai",
            selectedModel: "user-model",
          }),
        },
      }),
    ).rejects.toBeInstanceOf(BYOKConfigurationError);
  });

  it("wraps BYOK provider failure as BYOKExecutionError and never calls platform", async () => {
    const platformFactory = vi.fn(() => stubAdapter({ model: "platform" }));
    const failing: IAIProviderAdapter = stubAdapter({
      provider: "anthropic",
      model: "user-model",
      generateTriage: async () => {
        throw new AIProviderError("provider down");
      },
    });

    const adapter = await AIService.forUser("user-5", {
      byokRepository: {
        findActiveByUserId: async () => ({
          userId: "user-5",
          provider: "anthropic",
          selectedModel: "user-model",
          encryptedCredential: "aa:bb:cc",
        }),
      },
      decryptSecret: () => "sk-ant-user",
      createAnthropicAdapter: () => failing,
      createOpenAIAdapter: platformFactory,
    });

    await expect(adapter.generateTriage(encounter)).rejects.toBeInstanceOf(
      BYOKExecutionError,
    );
    await expect(adapter.generateTriage(encounter)).rejects.toThrow(
      BYOK_FAILURE_MESSAGE,
    );
    expect(platformFactory).not.toHaveBeenCalled();
  });

  it("treats disabled BYOK as inactive and uses platform AI", async () => {
    process.env.OPENAI_API_KEY = "sk-platform";
    process.env.AI_MODEL = "gpt-5.4-mini";

    const createOpenAIAdapter = vi.fn(() =>
      stubAdapter({ model: "gpt-5.4-mini" }),
    );

    await AIService.forUser("user-6", {
      byokRepository: {
        findActiveByUserId: async () => ({
          userId: "user-6",
          provider: "openai",
          selectedModel: "user-model",
          encryptedCredential: "aa:bb:cc",
          disabled: true,
        }),
      },
      createOpenAIAdapter,
    });

    expect(createOpenAIAdapter).toHaveBeenCalledWith({
      apiKey: "sk-platform",
      model: "gpt-5.4-mini",
    });
  });
});
