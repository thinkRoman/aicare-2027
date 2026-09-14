import Anthropic from "@anthropic-ai/sdk";
import type { EncounterInput } from "@/lib/schemas/encounter";
import type { TriageResult } from "@/lib/schemas/triage";
import type { IAIProviderAdapter } from "@/services/ai/adapters/IAIProviderAdapter";
import {
  STRUCTURED_OUTPUT_INSTRUCTION,
  TRIAGE_RESULT_JSON_SCHEMA,
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

const TRIAGE_TOOL_NAME = "submit_triage_result";

export type AnthropicCompatibleClient = {
  messages: {
    create: (
      body: Record<string, unknown>,
      options?: { signal?: AbortSignal },
    ) => Promise<unknown>;
  };
};

export type AnthropicAdapterOptions = {
  apiKey: string;
  model: string;
  timeoutMs?: number;
  client?: AnthropicCompatibleClient;
};

function buildEncounterUserContent(payload: EncounterInput): string {
  return JSON.stringify({
    chiefComplaint: payload.chiefComplaint,
    patientContext: payload.patientContext,
    anamnesis: payload.anamnesis,
    imageQuality: payload.image?.quality ?? null,
  });
}

export function parseAnthropicToolResponse(response: unknown): TriageResult {
  if (typeof response !== "object" || response === null) {
    throw new AIResponseValidationError("Anthropic response was not an object");
  }

  const content = (response as { content?: unknown }).content;
  if (!Array.isArray(content)) {
    throw new AIResponseValidationError(
      "Anthropic response content was missing",
    );
  }

  const toolBlock = content.find(
    (block) =>
      typeof block === "object" &&
      block !== null &&
      (block as { type?: unknown }).type === "tool_use" &&
      (block as { name?: unknown }).name === TRIAGE_TOOL_NAME,
  );

  if (!toolBlock || typeof toolBlock !== "object") {
    throw new AIResponseValidationError(
      "Anthropic response did not include the required triage tool payload",
    );
  }

  const input = (toolBlock as { input?: unknown }).input;
  return parseUnknownTriageResult(input);
}

function mapAnthropicFailure(error: unknown): never {
  if (
    error instanceof AITimeoutError ||
    error instanceof AIAuthenticationError ||
    error instanceof AIProviderError ||
    error instanceof AIResponseValidationError
  ) {
    throw error;
  }

  if (error instanceof Error && error.name === "AbortError") {
    throw new AITimeoutError("Anthropic provider request timed out", {
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
    throw new AIAuthenticationError(
      "Anthropic provider authentication failed",
      { cause: error },
    );
  }

  throw new AIProviderError("Anthropic provider request failed", {
    cause: error,
  });
}

export class AnthropicAdapter implements IAIProviderAdapter {
  readonly provider = "anthropic";
  readonly model: string;

  private readonly timeoutMs: number;
  private readonly client: AnthropicCompatibleClient;

  constructor(options: AnthropicAdapterOptions) {
    this.model = assertNonBlankModel(options.model, "Anthropic model");
    this.timeoutMs = options.timeoutMs ?? AI_TIMEOUT_MS;
    this.client =
      options.client ??
      (new Anthropic({
        apiKey: options.apiKey,
        timeout: this.timeoutMs,
      }) as unknown as AnthropicCompatibleClient);
  }

  async generateTriage(payload: EncounterInput): Promise<TriageResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response: unknown = await this.client.messages.create(
        {
          model: this.model,
          max_tokens: 1024,
          system: STRUCTURED_OUTPUT_INSTRUCTION,
          messages: [
            {
              role: "user",
              content: buildEncounterUserContent(payload),
            },
          ],
          tools: [
            {
              name: TRIAGE_TOOL_NAME,
              description:
                "Submit a schema-validated triage guidance result. Not a diagnosis.",
              input_schema: TRIAGE_RESULT_JSON_SCHEMA,
            },
          ],
          tool_choice: { type: "tool", name: TRIAGE_TOOL_NAME },
        },
        { signal: controller.signal },
      );

      return parseAnthropicToolResponse(response);
    } catch (error) {
      mapAnthropicFailure(error);
    } finally {
      clearTimeout(timer);
    }
  }
}
