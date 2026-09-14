import { afterEach, describe, expect, it } from "vitest";
import {
  FUTURE_AI_PROVIDER_IDS,
  assertImplementedProvider,
  assertNonBlankModel,
  loadDefaultLocalBaseUrl,
  loadPlatformAiConfig,
  normalizeLocalBaseUrl,
} from "@/services/ai/config";
import { AIConfigurationError } from "@/services/ai/errors";

describe("AI configuration", () => {
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

  it("loads valid platform configuration from OPENAI_API_KEY and AI_MODEL", () => {
    process.env.OPENAI_API_KEY = "sk-test-platform";
    process.env.AI_MODEL = "gpt-5.4-mini";

    expect(loadPlatformAiConfig()).toEqual({
      provider: "openai",
      apiKey: "sk-test-platform",
      model: "gpt-5.4-mini",
    });
  });

  it("fails when OPENAI_API_KEY is missing", () => {
    delete process.env.OPENAI_API_KEY;
    process.env.AI_MODEL = "gpt-5.4-mini";
    expect(() => loadPlatformAiConfig()).toThrow(AIConfigurationError);
    expect(() => loadPlatformAiConfig()).toThrow(/OPENAI_API_KEY/i);
  });

  it("fails when AI_MODEL is missing", () => {
    process.env.OPENAI_API_KEY = "sk-test-platform";
    delete process.env.AI_MODEL;
    expect(() => loadPlatformAiConfig()).toThrow(AIConfigurationError);
    expect(() => loadPlatformAiConfig()).toThrow(/AI_MODEL/i);
  });

  it("rejects blank model names", () => {
    expect(() => assertNonBlankModel("   ")).toThrow(AIConfigurationError);
  });

  it("rejects invalid and unimplemented future providers", () => {
    expect(() => assertImplementedProvider("nope")).toThrow(
      AIConfigurationError,
    );
    expect(() => assertImplementedProvider(FUTURE_AI_PROVIDER_IDS[0])).toThrow(
      /not implemented/i,
    );
  });

  it("accepts and normalizes a valid local base URL", () => {
    expect(normalizeLocalBaseUrl("http://127.0.0.1:1234/v1")).toBe(
      "http://127.0.0.1:1234/v1",
    );
    expect(normalizeLocalBaseUrl("http://127.0.0.1:1234")).toBe(
      "http://127.0.0.1:1234/v1",
    );
  });

  it("rejects malformed base URLs", () => {
    expect(() => normalizeLocalBaseUrl("not-a-url")).toThrow(
      AIConfigurationError,
    );
    expect(() =>
      normalizeLocalBaseUrl("http://user:pass@127.0.0.1:1234/v1"),
    ).toThrow(/credentials/i);
  });

  it("does not invent a model when loading platform config", () => {
    process.env.OPENAI_API_KEY = "sk-test-platform";
    process.env.AI_MODEL = "";
    expect(() => loadPlatformAiConfig()).toThrow(/AI_MODEL/i);
  });

  it("keeps BYOK independent from platform configuration", () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_MODEL;
    process.env.LOCAL_AI_BASE_URL = "http://127.0.0.1:1234/v1";
    expect(loadDefaultLocalBaseUrl()).toBe("http://127.0.0.1:1234/v1");
    expect(() => loadPlatformAiConfig()).toThrow(AIConfigurationError);
  });
});
