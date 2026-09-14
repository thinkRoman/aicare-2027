"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import type { TriageResult } from "@/lib/schemas/triage";
import {
  MIN_TOUCH_TARGET_PX,
  urgencyPresentation,
} from "@/lib/consumer/triageUi";

type TriageResultCardProps = {
  result: TriageResult & { overriddenBySafetyArbiter?: boolean };
};

export function TriageResultCard({ result }: TriageResultCardProps) {
  const urgency = urgencyPresentation(result.disposition);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  async function handleShare() {
    const checklist = result.pointOfCareChecklist
      .map((item) => `• ${item}`)
      .join("\n");
    const text = [
      `aiCARE triage summary (${urgency.label})`,
      result.plainEnglishSummary,
      "",
      "Next steps:",
      ...result.immediateActions.map((item) => `• ${item}`),
      "",
      "Show your doctor:",
      checklist,
    ].join("\n");

    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: "aiCARE triage summary",
          text,
        });
        setShareStatus("Shared.");
        return;
      }

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setShareStatus("Copied to clipboard.");
        return;
      }

      setShareStatus("Sharing is unavailable on this device.");
    } catch {
      setShareStatus("Sharing was cancelled or unavailable.");
    }
  }

  return (
    <article
      className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      aria-labelledby="triage-result-heading"
    >
      <header className="space-y-3">
        <p
          className={`inline-flex min-h-12 items-center rounded-full border px-4 text-sm font-semibold ${urgency.className}`}
          role="status"
          aria-label={`Urgency: ${urgency.label}. ${urgency.description}`}
        >
          {urgency.label}
        </p>
        <h2 id="triage-result-heading" className="text-xl font-semibold text-slate-900">
          Your guidance
        </h2>
        <p className="text-base text-slate-700">{result.plainEnglishSummary}</p>
        <p className="text-sm text-slate-500">{urgency.description}</p>
      </header>

      <section aria-labelledby="next-steps-heading">
        <h3 id="next-steps-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Plain-English next steps
        </h3>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-slate-800">
          {result.immediateActions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="red-flags-heading">
        <h3 id="red-flags-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Red flags to monitor
        </h3>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-slate-800">
          {result.redFlagsToMonitor.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="doctor-checklist-heading"
        className="rounded-xl bg-slate-50 p-4"
      >
        <h3 id="doctor-checklist-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Show your doctor
        </h3>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-slate-800">
          {result.pointOfCareChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          style={{ minHeight: MIN_TOUCH_TARGET_PX }}
          onClick={() => {
            void handleShare();
          }}
        >
          <Share2 className="h-4 w-4" aria-hidden />
          Share checklist
        </button>
        {shareStatus ? (
          <p className="mt-2 text-sm text-slate-600" role="status">
            {shareStatus}
          </p>
        ) : null}
      </section>
    </article>
  );
}
