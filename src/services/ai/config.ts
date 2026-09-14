import { z } from "zod";
import { AIConfigurationError } from "@/services/ai/errors";

/** Providers implemented in Gate 3. */
export const IMPLEMENTED_AI_PROVIDERS = ["openai", "anthropic", "local"] as const;

/** Reserved identifiers for later adapter work — not implemented in Gate 3. */
export const FUTURE_AI_PROVIDER_IDS = [
  "groq",
  "gemini",
  "kimi",
  "openrouter",
] as const;

export const AI_PROVIDER_IDS = [
  ...IMPLEMENTED_AI_PROVIDERS,
  ...FUTURE_AI_PROVIDER_IDS,
] as const;

export type ImplementedAiProvider = (typeof IMPLEMENTED_AI_PROVIDERS)[number];
export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

const NonEmptyString = z.string().trim().min(1);

export const PlatformAiConfigSchema = z.object({
  provider: z.literal("openai"),
  apiKey: NonEmptyString,
  model: NonEmptyString,
});

export type PlatformAiConfig = z.infer<typeof PlatformAiConfigSchema>;

export const LocalBaseUrlSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => {
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "base URL must be a valid http(s) URL" },
  );

/**
 * Normalizes a local OpenAI-compatible base URL to end with `/v1`.
 * Does not invent hosts or tunnels.
 */
export function normalizeLocalBaseUrl(baseUrl: string): string {
  const parsed = LocalBaseUrlSchema.safeParse(baseUrl);
  if (!parsed.success) {
    throw new AIConfigurationError("Invalid local AI base URL", {
      diagnostic: parsed.error.issues.map((issue) => issue.message).join("; "),
    });
  }

  const url = new URL(parsed.data);
  if (url.username || url.password) {
    throw new AIConfigurationError(
      "Local AI base URL must not embed credentials",
    );
  }

  let pathname = url.pathname.replace(/\/+$/, "");
  if (!pathname.endsWith("/v1")) {
    pathname = `${pathname}/v1`.replace(/\/{2,}/g, "/");
    if (!pathname.startsWith("/")) {
      pathname = `/${pathname}`;
    }
  }

  url.pathname = pathname;
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/+$/, "");
}

export function loadPlatformAiConfig(
  env: NodeJS.ProcessEnv = process.env,
): PlatformAiConfig {
  const apiKey = env.OPENAI_API_KEY?.trim() ?? "";
  const model = env.AI_MODEL?.trim() ?? "";

  if (!apiKey) {
    throw new AIConfigurationError(
      "OPENAI_API_KEY is missing. Configure the platform OpenAI credential.",
    );
  }
  if (!model) {
    throw new AIConfigurationError(
      "AI_MODEL is missing. Configure the platform default model.",
    );
  }

  const parsed = PlatformAiConfigSchema.safeParse({
    provider: "openai",
    apiKey,
    model,
  });

  if (!parsed.success) {
    throw new AIConfigurationError("Platform AI configuration is invalid", {
      diagnostic: parsed.error.issues.map((issue) => issue.message).join("; "),
    });
  }

  return parsed.data;
}

export function loadDefaultLocalBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = env.LOCAL_AI_BASE_URL?.trim();
  if (!configured) {
    throw new AIConfigurationError(
      "LOCAL_AI_BASE_URL is missing for local provider configuration",
    );
  }
  return normalizeLocalBaseUrl(configured);
}

export function assertImplementedProvider(
  provider: string,
): asserts provider is ImplementedAiProvider {
  if (
    !(IMPLEMENTED_AI_PROVIDERS as readonly string[]).includes(provider)
  ) {
    if ((FUTURE_AI_PROVIDER_IDS as readonly string[]).includes(provider)) {
      throw new AIConfigurationError(
        `AI provider "${provider}" is reserved but not implemented in Gate 3`,
      );
    }
    throw new AIConfigurationError(`Invalid AI provider: ${provider}`);
  }
}

export function assertNonBlankModel(model: string, label = "model"): string {
  const trimmed = model.trim();
  if (!trimmed) {
    throw new AIConfigurationError(`${label} must not be blank`);
  }
  return trimmed;
}
