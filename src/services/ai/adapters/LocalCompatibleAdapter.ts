import type { EncounterInput } from "@/lib/schemas/encounter";
import type { TriageResult } from "@/lib/schemas/triage";
import type { IAIProviderAdapter } from "@/services/ai/adapters/IAIProviderAdapter";
import {
  STRUCTURED_OUTPUT_INSTRUCTION,
  TRIAGE_RESULT_JSON_SCHEMA,
  extractJsonObject,
  parseUnknownTriageResult,
} from "@/services/ai/adapters/triageOutput";
import {
  assertNonBlankModel,
  normalizeLocalBaseUrl,
} from "@/services/ai/config";
import {
  AI_TIMEOUT_MS,
  AIAuthenticationError,
  AIProviderError,
  AIResponseValidationError,
  AITimeoutError,
} from "@/services/ai/errors";

export type LocalFetch = (
  input: string,
  init: RequestInit,
) => Promise<Response>;

export type LocalCompatibleAdapterOptions = {
  model: string;
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
  fetchImpl?: LocalFetch;
};

function buildEncounterUserContent(payload: EncounterInput): string {
  return JSON.stringify({
    chiefComplaint: payload.chiefComplaint,
    patientContext: payload.patientContext,
    anamnesis: payload.anamnesis,
    imageQuality: payload.image?.quality ?? null,
  });
}

export function parseLocalChatCompletion(response: unknown): TriageResult {
  if (typeof response !== "object" || response === null) {
    throw new AIResponseValidationError(
      "Local AI response was not an object",
    );
  }

  const choices = (response as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new AIResponseValidationError(
      "Local AI response contained no choices",
    );
  }

  const message = (choices[0] as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) {
    throw new AIResponseValidationError(
      "Local AI response message was missing",
    );
  }

  const content = (message as { content?: unknown }).content;
  if (typeof content !== "string") {
    throw new AIResponseValidationError(
      "Local AI response content was not a string",
    );
  }

  return parseUnknownTriageResult(extractJsonObject(content));
}

function mapLocalFailure(error: unknown): never {
  if (
    error instanceof AITimeoutError ||
    error instanceof AIAuthenticationError ||
    error instanceof AIProviderError ||
    error instanceof AIResponseValidationError
  ) {
    throw error;
  }

  if (error instanceof Error && error.name === "AbortError") {
    throw new AITimeoutError("Local AI provider request timed out", {
      cause: error,
    });
  }

  if (error instanceof TypeError) {
    throw new AIProviderError(
      "Local AI provider is unavailable. Confirm LM Studio or the OpenAI-compatible server is running and reachable.",
      { cause: error },
    );
  }

  throw new AIProviderError("Local AI provider request failed", {
    cause: error,
  });
}

export class LocalCompatibleAdapter implements IAIProviderAdapter {
  readonly provider = "local";
  readonly model: string;
  readonly baseUrl: string;

  private readonly apiKey?: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: LocalFetch;

  constructor(options: LocalCompatibleAdapterOptions) {
    this.model = assertNonBlankModel(options.model, "Local AI model");
    this.baseUrl = normalizeLocalBaseUrl(options.baseUrl);
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? AI_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async generateTriage(payload: EncounterInput): Promise<TriageResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const endpoint = `${this.baseUrl}/chat/completions`;

    try {
      const headers: Record<string, string> = {
        "content-type": "application/json",
      };
      if (this.apiKey) {
        headers.authorization = `Bearer ${this.apiKey}`;
      }

      const response = await this.fetchImpl(endpoint, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "system",
              content: STRUCTURED_OUTPUT_INSTRUCTION,
            },
            {
              role: "user",
              content: buildEncounterUserContent(payload),
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "triage_result",
              strict: true,
              schema: TRIAGE_RESULT_JSON_SCHEMA,
            },
          },
        }),
      });

      if (response.status === 401 || response.status === 403) {
        throw new AIAuthenticationError(
          "Local AI provider authentication failed",
        );
      }

      if (!response.ok) {
        throw new AIProviderError(
          `Local AI provider returned HTTP ${response.status}`,
        );
      }

      const body: unknown = await response.json();
      return parseLocalChatCompletion(body);
    } catch (error) {
      mapLocalFailure(error);
    } finally {
      clearTimeout(timer);
    }
  }
}
