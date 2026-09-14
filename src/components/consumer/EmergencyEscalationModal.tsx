"use client";

import { PhoneCall } from "lucide-react";
import { MIN_TOUCH_TARGET_PX } from "@/lib/consumer/triageUi";

type EmergencyEscalationModalProps = {
  action: string;
  onDismiss?: () => void;
};

export function EmergencyEscalationModal({
  action,
  onDismiss,
}: EmergencyEscalationModalProps) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="emergency-title"
      aria-describedby="emergency-description"
      className="fixed inset-0 z-50 flex items-end justify-center bg-red-950/80 p-4 sm:items-center"
    >
      <div className="w-full max-w-lg rounded-3xl border-2 border-red-200 bg-white p-6 text-slate-900 shadow-2xl">
        <div className="flex items-center gap-3 text-red-800">
          <PhoneCall className="h-7 w-7" aria-hidden />
          <h2 id="emergency-title" className="text-2xl font-bold">
            Emergency guidance
          </h2>
        </div>
        <p id="emergency-description" className="mt-4 text-lg text-slate-800">
          Based on what you shared, seek emergency care now. aiCARE provides
          triage guidance only and is not a diagnosis.
        </p>
        <p
          className="mt-6 rounded-2xl bg-red-700 px-4 py-4 text-center text-xl font-semibold text-white"
          role="status"
        >
          {action}
        </p>
        {onDismiss ? (
          <button
            type="button"
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            style={{ minHeight: MIN_TOUCH_TARGET_PX }}
            onClick={onDismiss}
          >
            Close
          </button>
        ) : null}
      </div>
    </div>
  );
}
