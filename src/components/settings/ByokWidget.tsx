"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  FUTURE_AI_PROVIDER_IDS,
  IMPLEMENTED_AI_PROVIDERS,
  type AiProviderId,
  type ImplementedAiProvider,
} from "@/services/ai/config";
import { MIN_TOUCH_TARGET_PX } from "@/lib/consumer/triageUi";

export type ByokSanitizedConfig = {
  provider: string;
  selectedModel: string;
  keyLast4?: string;
  updatedAt: string;
  disabled: boolean;
};

type ByokWidgetProps = {
  authenticated: boolean;
};

type ProviderOption = {
  id: AiProviderId;
  label: string;
  available: boolean;
};

const PROVIDER_OPTIONS: ProviderOption[] = [
  { id: "openai", label: "OpenAI", available: true },
  { id: "anthropic", label: "Anthropic", available: true },
  { id: "groq", label: "Groq", available: false },
  { id: "gemini", label: "Gemini", available: false },
  { id: "kimi", label: "Kimi", available: false },
  { id: "openrouter", label: "OpenRouter", available: false },
  { id: "local", label: "Local / OpenAI-compatible", available: true },
];

const AVAILABLE = new Set<string>(IMPLEMENTED_AI_PROVIDERS);
const RESERVED = new Set<string>(FUTURE_AI_PROVIDER_IDS);

export function ByokWidget({ authenticated }: ByokWidgetProps) {
  const [config, setConfig] = useState<ByokSanitizedConfig | null>(null);
  const [provider, setProvider] = useState<ImplementedAiProvider>("openai");
  const [selectedModel, setSelectedModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:1234/v1");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadConfig = useCallback(async () => {
    if (!authenticated) {
      setConfig(null);
      return;
    }
    try {
      const response = await fetch("/api/byok");
      const json = (await response.json()) as {
        ok: boolean;
        config: ByokSanitizedConfig | null;
        message?: string;
      };
      if (!response.ok || !json.ok) {
        setError(json.message ?? "Unable to load AI configuration.");
        return;
      }
      setConfig(json.config);
      if (json.config && AVAILABLE.has(json.config.provider)) {
        setProvider(json.config.provider as ImplementedAiProvider);
        setSelectedModel(json.config.selectedModel);
      }
    } catch {
      setError("Unable to load AI configuration.");
    }
  }, [authenticated]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadConfig();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadConfig]);

  if (!authenticated) {
    return (
      <section
        className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
        aria-labelledby="byok-unavailable-heading"
      >
        <h2
          id="byok-unavailable-heading"
          className="text-lg font-semibold text-slate-900"
        >
          Advanced AI configuration unavailable
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          Sign in to manage encrypted provider credentials. Anonymous visitors
          cannot save a personal AI configuration.
        </p>
      </section>
    );
  }

  async function mutate(body: unknown) {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch("/api/byok", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await response.json()) as {
        ok: boolean;
        config: ByokSanitizedConfig | null;
        message?: string;
      };
      if (!response.ok || !json.ok) {
        setError(json.message ?? "Unable to update AI configuration.");
        return;
      }
      setConfig(json.config);
      setApiKey("");
      setStatus(
        json.config
          ? "Saved. Your key is encrypted before storage and is never shown again."
          : "Configuration removed. Triage will use the platform default.",
      );
    } catch {
      setError("Unable to update AI configuration. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (RESERVED.has(provider) || !AVAILABLE.has(provider)) {
      setError("That provider is not available yet.");
      return;
    }
    if (!selectedModel.trim()) {
      setError("Enter the exact model identifier for your provider.");
      return;
    }
    if (!apiKey.trim()) {
      setError("Enter a credential to save or replace this configuration.");
      return;
    }
    await mutate({
      action: "upsert",
      provider,
      selectedModel: selectedModel.trim(),
      apiKey: apiKey.trim(),
      ...(provider === "local" ? { baseUrl: baseUrl.trim() } : {}),
    });
  }

  return (
    <section
      className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5"
      aria-labelledby="byok-heading"
    >
      <div>
        <h2 id="byok-heading" className="text-lg font-semibold text-slate-900">
          Advanced AI configuration
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Your key is encrypted before storage and is never shown again. Disable
          or remove this configuration to use the platform default.
        </p>
      </div>

      {config ? (
        <div
          className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800"
          aria-label="Saved configuration summary"
        >
          <p>
            <span className="font-medium">Provider:</span> {config.provider}
          </p>
          <p>
            <span className="font-medium">Model:</span> {config.selectedModel}
          </p>
          <p>
            <span className="font-medium">Key ending:</span> ••••
            {config.keyLast4 ?? "????"}
          </p>
          <p>
            <span className="font-medium">Status:</span>{" "}
            {config.disabled ? "Disabled" : "Enabled"}
          </p>
          <p>
            <span className="font-medium">Updated:</span>{" "}
            {new Date(config.updatedAt).toLocaleString()}
          </p>
        </div>
      ) : (
        <p className="text-sm text-slate-600">
          No personal configuration saved. Triage currently uses the platform
          default.
        </p>
      )}

      <form className="space-y-4" onSubmit={(event) => void handleSave(event)}>
        <fieldset>
          <legend className="text-sm font-medium text-slate-800">Provider</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {PROVIDER_OPTIONS.map((option) => {
              const selected = provider === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={!option.available}
                  aria-pressed={selected}
                  className={`inline-flex min-h-12 items-center justify-between rounded-xl border px-3 text-left text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-60 ${
                    selected
                      ? "border-teal-800 bg-teal-700 text-white"
                      : "border-slate-300 bg-white text-slate-800"
                  }`}
                  style={{ minHeight: MIN_TOUCH_TARGET_PX }}
                  onClick={() => {
                    if (option.available) {
                      setProvider(option.id as ImplementedAiProvider);
                    }
                  }}
                >
                  <span>{option.label}</span>
                  {!option.available ? (
                    <span className="text-xs font-normal">Unavailable</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="byok-model" className="text-sm font-medium text-slate-800">
            Model identifier
          </label>
          <input
            id="byok-model"
            value={selectedModel}
            onChange={(event) => setSelectedModel(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 text-base text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            style={{ minHeight: MIN_TOUCH_TARGET_PX }}
            placeholder="Exact model id from your provider"
            autoComplete="off"
          />
        </div>

        {provider === "local" ? (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label
              htmlFor="byok-base-url"
              className="text-sm font-medium text-slate-800"
            >
              Local OpenAI-compatible base URL
            </label>
            <input
              id="byok-base-url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              style={{ minHeight: MIN_TOUCH_TARGET_PX }}
              placeholder="http://127.0.0.1:1234/v1"
              autoComplete="off"
            />
            <p className="text-xs text-slate-600">
              Use an OpenAI-compatible endpoint such as LM Studio (for example
              http://127.0.0.1:1234/v1). Enter the exact model identifier your
              local server exposes. The endpoint must be reachable from the
              running aiCARE server. Automatic tunneling is not performed.
            </p>
          </div>
        ) : null}

        <div>
          <label htmlFor="byok-api-key" className="text-sm font-medium text-slate-800">
            Provider credential
          </label>
          <input
            id="byok-api-key"
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 text-base text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            style={{ minHeight: MIN_TOUCH_TARGET_PX }}
            placeholder="Paste key to save or replace"
            autoComplete="off"
          />
          <p className="mt-2 text-xs text-slate-600">
            Your key is encrypted before storage and is never shown again.
            Disable or remove this configuration to use the platform default.
          </p>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="inline-flex w-full items-center justify-center rounded-xl bg-teal-800 px-4 text-sm font-semibold text-white disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-900"
          style={{ minHeight: MIN_TOUCH_TARGET_PX }}
        >
          {config ? "Replace configuration" : "Save configuration"}
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !config || !config.disabled}
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          style={{ minHeight: MIN_TOUCH_TARGET_PX }}
          onClick={() => void mutate({ action: "enable" })}
        >
          Enable
        </button>
        <button
          type="button"
          disabled={busy || !config || config.disabled}
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          style={{ minHeight: MIN_TOUCH_TARGET_PX }}
          onClick={() => void mutate({ action: "disable" })}
        >
          Disable
        </button>
        <button
          type="button"
          disabled={busy || !config}
          className="inline-flex items-center justify-center rounded-xl border border-red-300 bg-white px-4 text-sm font-medium text-red-800 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          style={{ minHeight: MIN_TOUCH_TARGET_PX }}
          onClick={() => void mutate({ action: "delete" })}
        >
          Delete
        </button>
      </div>

      {status ? (
        <p className="text-sm text-emerald-800" role="status">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-amber-900" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
