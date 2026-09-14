import { decryptSecret } from "@/lib/security/crypto";
import { AnthropicAdapter } from "@/services/ai/adapters/AnthropicAdapter";
import type { IAIProviderAdapter } from "@/services/ai/adapters/IAIProviderAdapter";
import { LocalCompatibleAdapter } from "@/services/ai/adapters/LocalCompatibleAdapter";
import { OpenAIAdapter } from "@/services/ai/adapters/OpenAIAdapter";
import { mongoByokRepository } from "@/services/ai/byokRepository";
import {
  assertImplementedProvider,
  assertNonBlankModel,
  loadDefaultLocalBaseUrl,
  loadPlatformAiConfig,
  normalizeLocalBaseUrl,
  type ImplementedAiProvider,
} from "@/services/ai/config";
import {
  BYOK_FAILURE_MESSAGE,
  BYOKConfigurationError,
  BYOKExecutionError,
} from "@/services/ai/errors";

export type ByokRecord = {
  userId: string;
  provider: string;
  selectedModel: string;
  encryptedCredential?: string;
  baseUrl?: string;
  /** When true, BYOK is inactive and platform AI is used. */
  disabled?: boolean;
};

export type ByokConfigRepository = {
  findActiveByUserId(userId: string): Promise<ByokRecord | null>;
};

export type SecretDecryptor = (ciphertext: string) => string;

export type AIServiceDependencies = {
  byokRepository?: ByokConfigRepository;
  decryptSecret?: SecretDecryptor;
  loadPlatformConfig?: typeof loadPlatformAiConfig;
  loadLocalBaseUrl?: typeof loadDefaultLocalBaseUrl;
  createOpenAIAdapter?: (options: {
    apiKey: string;
    model: string;
    baseUrl?: string;
  }) => IAIProviderAdapter;
  createAnthropicAdapter?: (options: {
    apiKey: string;
    model: string;
  }) => IAIProviderAdapter;
  createLocalAdapter?: (options: {
    apiKey?: string;
    model: string;
    baseUrl: string;
  }) => IAIProviderAdapter;
};

const defaultRepository: ByokConfigRepository = mongoByokRepository;

function createDefaultOpenAIAdapter(options: {
  apiKey: string;
  model: string;
  baseUrl?: string;
}): IAIProviderAdapter {
  return new OpenAIAdapter(options);
}

function createDefaultAnthropicAdapter(options: {
  apiKey: string;
  model: string;
}): IAIProviderAdapter {
  return new AnthropicAdapter(options);
}

function createDefaultLocalAdapter(options: {
  apiKey?: string;
  model: string;
  baseUrl: string;
}): IAIProviderAdapter {
  return new LocalCompatibleAdapter(options);
}

/**
 * Wraps a BYOK-selected adapter so provider failures become BYOKExecutionError
 * and never silently fall back to the platform key.
 */
class ByokGuardedAdapter implements IAIProviderAdapter {
  readonly provider: string;
  readonly model: string;
  readonly baseUrl?: string;

  constructor(private readonly inner: IAIProviderAdapter) {
    this.provider = inner.provider;
    this.model = inner.model;
    this.baseUrl = inner.baseUrl;
  }

  async generateTriage(
    payload: Parameters<IAIProviderAdapter["generateTriage"]>[0],
  ) {
    try {
      return await this.inner.generateTriage(payload);
    } catch (error) {
      if (error instanceof BYOKExecutionError) {
        throw error;
      }
      throw new BYOKExecutionError(BYOK_FAILURE_MESSAGE, { cause: error });
    }
  }
}

function buildPlatformAdapter(
  dependencies: AIServiceDependencies,
): IAIProviderAdapter {
  const loadPlatform = dependencies.loadPlatformConfig ?? loadPlatformAiConfig;
  const createOpenAI =
    dependencies.createOpenAIAdapter ?? createDefaultOpenAIAdapter;
  const platform = loadPlatform();

  return createOpenAI({
    apiKey: platform.apiKey,
    model: platform.model,
  });
}

function buildByokAdapter(
  record: ByokRecord,
  dependencies: AIServiceDependencies,
): IAIProviderAdapter {
  assertImplementedProvider(record.provider);
  const provider = record.provider as ImplementedAiProvider;
  const model = assertNonBlankModel(record.selectedModel, "BYOK selectedModel");

  if (!record.encryptedCredential) {
    throw new BYOKConfigurationError(
      "Active BYOK configuration is missing an encrypted credential",
    );
  }

  const decrypt = dependencies.decryptSecret ?? decryptSecret;
  let apiKey: string;
  try {
    apiKey = decrypt(record.encryptedCredential);
  } catch (error) {
    throw new BYOKConfigurationError(
      "Active BYOK configuration credential could not be decrypted",
      { cause: error },
    );
  }

  if (!apiKey.trim()) {
    throw new BYOKConfigurationError(
      "Active BYOK configuration credential is empty after decryption",
    );
  }

  const createOpenAI =
    dependencies.createOpenAIAdapter ?? createDefaultOpenAIAdapter;
  const createAnthropic =
    dependencies.createAnthropicAdapter ?? createDefaultAnthropicAdapter;
  const createLocal =
    dependencies.createLocalAdapter ?? createDefaultLocalAdapter;
  const loadLocalBaseUrl =
    dependencies.loadLocalBaseUrl ?? loadDefaultLocalBaseUrl;

  let adapter: IAIProviderAdapter;

  switch (provider) {
    case "openai":
      adapter = createOpenAI({
        apiKey,
        model,
        baseUrl: record.baseUrl?.trim()
          ? normalizeLocalBaseUrl(record.baseUrl)
          : undefined,
      });
      break;
    case "anthropic":
      adapter = createAnthropic({ apiKey, model });
      break;
    case "local": {
      const baseUrl = record.baseUrl?.trim()
        ? normalizeLocalBaseUrl(record.baseUrl)
        : loadLocalBaseUrl();
      adapter = createLocal({
        apiKey,
        model,
        baseUrl,
      });
      break;
    }
  }

  return new ByokGuardedAdapter(adapter);
}

/**
 * Resolves a provider adapter for anonymous platform use or authenticated BYOK.
 * Platform default: OPENAI_API_KEY + AI_MODEL.
 * Active BYOK ignores AI_MODEL and never silently falls back on failure.
 */
export class AIService {
  static async forUser(
    userId: string | null,
    dependencies: AIServiceDependencies = {},
  ): Promise<IAIProviderAdapter> {
    if (userId === null) {
      return buildPlatformAdapter(dependencies);
    }

    const repository = dependencies.byokRepository ?? defaultRepository;
    const record = await repository.findActiveByUserId(userId);

    if (!record || record.disabled === true) {
      return buildPlatformAdapter(dependencies);
    }

    return buildByokAdapter(record, dependencies);
  }
}
