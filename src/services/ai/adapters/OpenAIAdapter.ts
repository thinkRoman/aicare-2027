import OpenAI from "openai";
import type { EncounterInput } from "@/lib/schemas/encounter";
import type { TriageResult } from "@/lib/schemas/triage";
import type { IAIProviderAdapter } from "@/services/ai/adapters/IAIProviderAdapter";
import {
  STRUCTURED_OUTPUT_INSTRUCTION,
  TRIAGE_RESULT_JSON_SCHEMA,
  extractJsonObject,
  parseUnknownTriageResult,
} from "@/services/ai/adapters/triageOutput";
import { assertNonBlankModel } from "@/services/ai/config";
import {
  AI_TIMEOUT_MS,
  AIAuthenticationError,
  AIProviderError,
  AIResponseValidationError,
  AITimeoutError,
} from "@/services/ai/errors";

export type OpenAICompatibleClient = {
  chat: {
    completions: {
      create: (
        body: Record<string, unknown>,
        options?: { signal?: AbortSignal },
      ) => Promise<unknown>;
    };
  };
};

export type OpenAIAdapterOptions = {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
  client?: OpenAICompatibleClient;
};

function buildEncounterUserContent(payload: EncounterInput): string {
  return JSON.stringify({
    chiefComplaint: payload.chiefComplaint,
    patientContext: payload.patientContext,
    anamnesis: payload.anamnesis,
    imageQuality: payload.image?.quality ?? null,
  });
}

export function parseOpenAiChatCompletion(response: unknown): TriageResult {
  if (typeof response !== "object" || response === null) {
    throw new AIResponseValidationError("OpenAI response was not an object");
  }

  const choices = (response as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new AIResponseValidationError("OpenAI response contained no choices");
  }

  const message = (choices[0] as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) {
    throw new AIResponseValidationError("OpenAI response message was missing");
  }

  const content = (message as { content?: unknown }).content;
  if (typeof content !== "string") {
    throw new AIResponseValidationError(
      "OpenAI response content was not a string",
    );
  }

  return parseUnknownTriageResult(extractJsonObject(content));
}

function mapOpenAiFailure(error: unknown): never {
  if (
    error instanceof AITimeoutError ||
    error instanceof AIAuthenticationError ||
    error instanceof AIProviderError ||
    error instanceof AIResponseValidationError
  ) {
    throw error;
  }

  if (error instanceof Error && error.name === "AbortError") {
    throw new AITimeoutError("OpenAI provider request timed out", {
      cause: error,
    });
  }

  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : undefined;

  if (status === 401 || status === 403) {
    throw new AIAuthenticationError("OpenAI provider authentication failed", {
      cause: error,
    });
  }

  throw new AIProviderError("OpenAI provider request failed", { cause: error });
}

export class OpenAIAdapter implements IAIProviderAdapter {
  readonly provider = "openai";
  readonly model: string;
  readonly baseUrl?: string;

  private readonly timeoutMs: number;
  private readonly client: OpenAICompatibleClient;

  constructor(options: OpenAIAdapterOptions) {
    this.model = assertNonBlankModel(options.model, "OpenAI model");
    this.baseUrl = options.baseUrl;
    this.timeoutMs = options.timeoutMs ?? AI_TIMEOUT_MS;
    this.client =
      options.client ??
      (new OpenAI({
        apiKey: options.apiKey,
        baseURL: options.baseUrl,
        timeout: this.timeoutMs,
      }) as unknown as OpenAICompatibleClient);
  }

  async generateTriage(payload: EncounterInput): Promise<TriageResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response: unknown = await this.client.chat.completions.create(
        {
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
        },
        { signal: controller.signal },
      );

      return parseOpenAiChatCompletion(response);
    } catch (error) {
      mapOpenAiFailure(error);
    } finally {
      clearTimeout(timer);
    }
  }
}
