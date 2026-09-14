"use client";

import Link from "next/link";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { Loader2, Mic, MicOff, Settings } from "lucide-react";
import {
  CameraCapture,
  type CapturedImageDraft,
} from "@/components/consumer/CameraCapture";
import { EmergencyEscalationModal } from "@/components/consumer/EmergencyEscalationModal";
import {
  SmartTapSelectors,
  type SmartTapValues,
} from "@/components/consumer/SmartTapSelectors";
import { TriageResultCard } from "@/components/consumer/TriageResultCard";
import { PRODUCT_BRAND, PRODUCT_TAGLINE } from "@/lib/brand";
import {
  CONSUMER_CONSENT_TEXT,
  MIN_TOUCH_TARGET_PX,
  consumerSafeErrorMessage,
  type ConsumerTriageResponse,
} from "@/lib/consumer/triageUi";
import {
  MICROPHONE_PERMISSION_DENIED_MESSAGE,
  isPermissionDeniedError,
} from "@/lib/mobile/permissions";
import type { TriageResult } from "@/lib/schemas/triage";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult:
    | ((event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      }) => void)
    | null;
  onerror: ((event?: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type IntakeCanvasProps = {
  submitTriage?: (body: unknown) => Promise<ConsumerTriageResponse>;
};

function detectSpeechSupport(): boolean {
  if (typeof window === "undefined") return false;
  const host = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return Boolean(host.SpeechRecognition || host.webkitSpeechRecognition);
}

const defaultSmartTap: SmartTapValues = {
  ageGroup: "adult",
  feverIndicated: false,
  isPregnant: false,
  immunocompromised: false,
  anamnesis: { severity: 5 },
};

async function defaultSubmitTriage(
  body: unknown,
): Promise<ConsumerTriageResponse> {
  const response = await fetch("/api/triage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await response.json()) as ConsumerTriageResponse;
}

export function IntakeCanvas({
  submitTriage = defaultSubmitTriage,
}: IntakeCanvasProps) {
  const [complaint, setComplaint] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [smartTap, setSmartTap] = useState<SmartTapValues>(defaultSmartTap);
  const [listening, setListening] = useState(false);
  const [speechSupported] = useState(detectSpeechSupport);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<
    (TriageResult & { overriddenBySafetyArbiter?: boolean }) | null
  >(null);
  const [emergencyAction, setEmergencyAction] = useState<string | null>(null);
  const [imageDraft, setImageDraft] = useState<CapturedImageDraft | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  function startListening() {
    const host = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const ctor = host.SpeechRecognition || host.webkitSpeechRecognition;
    if (!ctor) {
      setError("Voice input is not available in this browser.");
      return;
    }

    const recognition = new ctor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) {
        setComplaint((current) =>
          current.trim() ? `${current.trim()} ${transcript}` : transcript,
        );
      }
    };
    recognition.onerror = (event?: { error?: string }) => {
      setListening(false);
      const denied =
        event?.error === "not-allowed" ||
        event?.error === "service-not-allowed";
      setError(
        denied
          ? MICROPHONE_PERMISSION_DENIED_MESSAGE
          : "Voice input stopped. You can keep typing.",
      );
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
      setError(null);
    } catch (error) {
      setListening(false);
      setError(
        isPermissionDeniedError(error)
          ? MICROPHONE_PERMISSION_DENIED_MESSAGE
          : "Voice input stopped. You can keep typing.",
      );
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setEmergencyAction(null);

    if (!consentGiven) {
      setError("Please confirm the consent statement before continuing.");
      return;
    }
    if (complaint.trim().length < 3) {
      setError("Please describe what is going on in a few words.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        consentAcknowledged: true as const,
        chiefComplaint: complaint.trim(),
        patientContext: {
          ageGroup: smartTap.ageGroup,
          approximateAgeYears: smartTap.approximateAgeYears,
          ageDays: smartTap.ageDays,
          feverIndicated: smartTap.feverIndicated,
          isPregnant: smartTap.isPregnant,
          immunocompromised: smartTap.immunocompromised,
          activeMedications: [] as string[],
          knownAllergies: [] as string[],
        },
        anamnesis: smartTap.anamnesis,
        locale:
          typeof navigator !== "undefined" ? navigator.language : undefined,
      };

      void imageDraft;

      const response = await submitTriage(payload);
      if (!response.ok) {
        setError(consumerSafeErrorMessage(response));
        return;
      }
      if (response.status === "diverted_emergency") {
        setEmergencyAction(response.emergency.action);
        return;
      }
      setResult(response.triageResult);
    } catch {
      setError("Triage is temporarily unavailable. Please try again.");
    } finally {
      setLoading(false);
      stopListening();
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 overflow-x-hidden px-4 py-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-800">
            {PRODUCT_BRAND}
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            Tell us what&apos;s going on
          </h1>
          <p className="mt-2 text-sm text-slate-600">{PRODUCT_TAGLINE}</p>
        </div>
        <Link
          href="/settings"
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          style={{
            minHeight: MIN_TOUCH_TARGET_PX,
            minWidth: MIN_TOUCH_TARGET_PX,
          }}
          aria-label="Open advanced settings"
        >
          <Settings className="h-5 w-5" aria-hidden />
        </Link>
      </header>

      <form
        className="space-y-6"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <label
            htmlFor="chief-complaint"
            className="text-sm font-medium text-slate-800"
          >
            What feels wrong?
          </label>
          <textarea
            id="chief-complaint"
            required
            rows={5}
            value={complaint}
            onChange={(event) => setComplaint(event.target.value)}
            enterKeyHint="done"
            autoComplete="off"
            inputMode="text"
            className="w-full rounded-xl border border-slate-300 px-3 py-3 text-base text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            placeholder="Describe symptoms in your own words"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              style={{ minHeight: MIN_TOUCH_TARGET_PX }}
              disabled={!speechSupported}
              aria-pressed={listening}
              onClick={() => {
                if (listening) stopListening();
                else startListening();
              }}
            >
              {listening ? (
                <MicOff className="h-4 w-4" aria-hidden />
              ) : (
                <Mic className="h-4 w-4" aria-hidden />
              )}
              {listening ? "Stop voice" : "Speak"}
            </button>
            {!speechSupported ? (
              <p className="self-center text-xs text-slate-500">
                Voice input unavailable here — typing still works.
              </p>
            ) : null}
          </div>
        </section>

        <SmartTapSelectors value={smartTap} onChange={setSmartTap} />
        <CameraCapture onCapture={setImageDraft} />
        {imageDraft ? (
          <p className="text-sm text-slate-600" role="status">
            Photo quality looks usable. Private upload uses a secure encounter
            link after triage starts; the photo is not published.
          </p>
        ) : null}

        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-teal-50/60 p-4">
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={(event) => setConsentGiven(event.target.checked)}
            className="mt-1 h-5 w-5 accent-teal-700"
            aria-required="true"
          />
          <span className="text-sm text-slate-800">{CONSUMER_CONSENT_TEXT}</span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-800 px-4 text-base font-semibold text-white disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-900"
          style={{ minHeight: MIN_TOUCH_TARGET_PX }}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : null}
          {loading ? "Reviewing safely…" : "Get triage guidance"}
        </button>
      </form>

      {error ? (
        <p
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {result ? <TriageResultCard result={result} /> : null}
      {emergencyAction ? (
        <EmergencyEscalationModal
          action={emergencyAction}
          onDismiss={() => setEmergencyAction(null)}
        />
      ) : null}
    </div>
  );
}
