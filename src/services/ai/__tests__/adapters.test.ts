import { describe, expect, it, vi } from "vitest";
import type { EncounterInput } from "@/lib/schemas/encounter";
import { AnthropicAdapter } from "@/services/ai/adapters/AnthropicAdapter";
import { LocalCompatibleAdapter } from "@/services/ai/adapters/LocalCompatibleAdapter";
import { OpenAIAdapter } from "@/services/ai/adapters/OpenAIAdapter";
import {
  AIAuthenticationError,
  AIProviderError,
  AIResponseValidationError,
  AITimeoutError,
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

const validTriage = {
  disposition: "routine",
  rationale: "Candidate routine disposition for adapter testing only.",
  plainEnglishSummary: "This is a candidate summary for adapter testing only.",
  immediateActions: ["Rest and reassess if symptoms change."],
  redFlagsToMonitor: ["Worsening symptoms that concern you."],
  pointOfCareChecklist: ["Share the timeline of symptoms with a clinician."],
  confidenceScore: 0.4,
  clinicalFlags: [],
};

describe("OpenAIAdapter", () => {
  it("returns a validated TriageResult for structured JSON", async () => {
    const create = vi.fn(async () => ({
      choices: [{ message: { content: JSON.stringify(validTriage) } }],
    }));

    const adapter = new OpenAIAdapter({
      apiKey: "sk-test",
      model: "configured-model",
      client: { chat: { completions: { create } } },
    });

    const result = await adapter.generateTriage(encounter);
    expect(result.disposition).toBe("routine");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: "configured-model" }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("rejects malformed JSON and conversational text", async () => {
    const adapter = new OpenAIAdapter({
      apiKey: "sk-test",
      model: "configured-model",
      client: {
        chat: {
          completions: {
            create: async () => ({
              choices: [{ message: { content: "You should feel fine." } }],
            }),
          },
        },
      },
    });

    await expect(adapter.generateTriage(encounter)).rejects.toBeInstanceOf(
      AIResponseValidationError,
    );
  });

  it("rejects schema-invalid JSON", async () => {
    const adapter = new OpenAIAdapter({
      apiKey: "sk-test",
      model: "configured-model",
      client: {
        chat: {
          completions: {
            create: async () => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({ disposition: "routine" }),
                  },
                },
              ],
            }),
          },
        },
      },
    });

    await expect(adapter.generateTriage(encounter)).rejects.toBeInstanceOf(
      AIResponseValidationError,
    );
  });

  it("maps authentication failures to typed errors", async () => {
    const adapter = new OpenAIAdapter({
      apiKey: "sk-test",
      model: "configured-model",
      client: {
        chat: {
          completions: {
            create: async () => {
              const error = new Error("unauthorized") as Error & {
                status: number;
              };
              error.status = 401;
              throw error;
            },
          },
        },
      },
    });

    await expect(adapter.generateTriage(encounter)).rejects.toBeInstanceOf(
      AIAuthenticationError,
    );
  });

  it("aborts on timeout", async () => {
    const adapter = new OpenAIAdapter({
      apiKey: "sk-test",
      model: "configured-model",
      timeoutMs: 20,
      client: {
        chat: {
          completions: {
            create: async (_body, options) =>
              await new Promise((_resolve, reject) => {
                options?.signal?.addEventListener("abort", () => {
                  const error = new Error("aborted");
                  error.name = "AbortError";
                  reject(error);
                });
              }),
          },
        },
      },
    });

    await expect(adapter.generateTriage(encounter)).rejects.toBeInstanceOf(
      AITimeoutError,
    );
  });
});

describe("AnthropicAdapter", () => {
  it("returns a validated TriageResult from tool input", async () => {
    const create = vi.fn(async () => ({
      content: [
        {
          type: "tool_use",
          name: "submit_triage_result",
          input: validTriage,
        },
      ],
    }));

    const adapter = new AnthropicAdapter({
      apiKey: "sk-ant-test",
      model: "user-selected-anthropic-model",
      client: { messages: { create } },
    });

    const result = await adapter.generateTriage(encounter);
    expect(result.disposition).toBe("routine");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ model: "user-selected-anthropic-model" }),
      expect.any(Object),
    );
  });

  it("rejects malformed tool arguments", async () => {
    const adapter = new AnthropicAdapter({
      apiKey: "sk-ant-test",
      model: "user-selected-anthropic-model",
      client: {
        messages: {
          create: async () => ({
            content: [
              {
                type: "tool_use",
                name: "submit_triage_result",
                input: { disposition: "self_care" },
              },
            ],
          }),
        },
      },
    });

    await expect(adapter.generateTriage(encounter)).rejects.toBeInstanceOf(
      AIResponseValidationError,
    );
  });

  it("maps provider failures without platform fallback semantics", async () => {
    const adapter = new AnthropicAdapter({
      apiKey: "sk-ant-test",
      model: "user-selected-anthropic-model",
      client: {
        messages: {
          create: async () => {
            throw new Error("anthropic down");
          },
        },
      },
    });

    await expect(adapter.generateTriage(encounter)).rejects.toBeInstanceOf(
      AIProviderError,
    );
  });

  it("aborts on timeout", async () => {
    const adapter = new AnthropicAdapter({
      apiKey: "sk-ant-test",
      model: "user-selected-anthropic-model",
      timeoutMs: 20,
      client: {
        messages: {
          create: async (_body, options) =>
            await new Promise((_resolve, reject) => {
              options?.signal?.addEventListener("abort", () => {
                const error = new Error("aborted");
                error.name = "AbortError";
                reject(error);
              });
            }),
        },
      },
    });

    await expect(adapter.generateTriage(encounter)).rejects.toBeInstanceOf(
      AITimeoutError,
    );
  });
});

describe("LocalCompatibleAdapter", () => {
  it("uses the LM Studio base URL and exact configured model identifier", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        choices: [{ message: { content: JSON.stringify(validTriage) } }],
      }),
    );

    const adapter = new LocalCompatibleAdapter({
      model: "qwen2.5-7b-instruct-custom",
      baseUrl: "http://127.0.0.1:1234/v1",
      fetchImpl,
    });

    const result = await adapter.generateTriage(encounter);
    expect(result.disposition).toBe("routine");
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:1234/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("qwen2.5-7b-instruct-custom"),
      }),
    );
  });

  it("rejects malformed local responses", async () => {
    const adapter = new LocalCompatibleAdapter({
      model: "any-local-model",
      baseUrl: "http://127.0.0.1:1234/v1",
      fetchImpl: async () =>
        Response.json({
          choices: [{ message: { content: "feel better soon" } }],
        }),
    });

    await expect(adapter.generateTriage(encounter)).rejects.toBeInstanceOf(
      AIResponseValidationError,
    );
  });

  it("reports local server unavailability", async () => {
    const adapter = new LocalCompatibleAdapter({
      model: "any-local-model",
      baseUrl: "http://127.0.0.1:1234/v1",
      fetchImpl: async () => {
        throw new TypeError("fetch failed");
      },
    });

    await expect(adapter.generateTriage(encounter)).rejects.toBeInstanceOf(
      AIProviderError,
    );
    await expect(adapter.generateTriage(encounter)).rejects.toThrow(/LM Studio/i);
  });

  it("aborts on timeout", async () => {
    const adapter = new LocalCompatibleAdapter({
      model: "any-local-model",
      baseUrl: "http://127.0.0.1:1234/v1",
      timeoutMs: 20,
      fetchImpl: async (_url, init) =>
        await new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        }),
    });

    await expect(adapter.generateTriage(encounter)).rejects.toBeInstanceOf(
      AITimeoutError,
    );
  });
});
