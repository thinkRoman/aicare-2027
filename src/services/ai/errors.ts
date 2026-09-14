export const BYOK_FAILURE_MESSAGE =
  "Configured AI provider failed. Check your settings or remove your key to use default triage." as const;

export const AI_TIMEOUT_MS = 15_000;

type AiErrorOptions = {
  cause?: unknown;
  /** Safe, non-secret diagnostic detail for server logs only — never an API key. */
  diagnostic?: string;
};

export class AiError extends Error {
  readonly diagnostic?: string;

  constructor(message: string, options: AiErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.diagnostic = options.diagnostic;
  }
}

/** Platform or shared AI configuration is missing or invalid. */
export class AIConfigurationError extends AiError {}

/** Upstream provider returned a transport or service failure. */
export class AIProviderError extends AiError {}

/** Provider rejected credentials. */
export class AIAuthenticationError extends AiError {}

/** Provider call exceeded the configured timeout. */
export class AITimeoutError extends AiError {}

/** Model output failed TriageResultSchema validation. */
export class AIResponseValidationError extends AiError {}

/** Persisted BYOK record is present but invalid or incomplete. */
export class BYOKConfigurationError extends AiError {}

/**
 * Active BYOK provider failed during execution.
 * Callers must not silently fall back to the platform key.
 */
export class BYOKExecutionError extends AiError {
  constructor(
    message: string = BYOK_FAILURE_MESSAGE,
    options: AiErrorOptions = {},
  ) {
    super(message, options);
  }
}

export function isAiError(error: unknown): error is AiError {
  return error instanceof AiError;
}
