/**
 * Resolves exactly one emergency action for the consumer escalation UI.
 * Never returns a competing list of international numbers.
 * Never infers locale from untrusted free text (e.g. chief complaint).
 */
export const UNKNOWN_EMERGENCY_ACTION = "Call Local Emergency Services" as const;

export type EmergencyResolution = {
  action: string;
  locale: string;
  known: boolean;
};

const LOCALE_ACTIONS: Record<string, string> = {
  US: "Call 911",
  USA: "Call 911",
  "EN-US": "Call 911",
  CA: "Call 911",
  "EN-CA": "Call 911",
};

function normalizeLocaleToken(value: string): string {
  return value.trim().toUpperCase().replace(/_/g, "-");
}

/**
 * @param locale - Trusted locale from server config or Accept-Language region only.
 *                 Pass null/undefined when unknown. Do not pass chief-complaint text.
 */
export function resolveEmergencyAction(
  locale?: string | null,
): EmergencyResolution {
  if (locale === undefined || locale === null || locale.trim() === "") {
    return {
      action: UNKNOWN_EMERGENCY_ACTION,
      locale: "unknown",
      known: false,
    };
  }

  const normalized = normalizeLocaleToken(locale);

  // Accept-Language style: en-US,en;q=0.9 → take first tag's region when present
  const primary = normalized.split(",")[0]?.split(";")[0] ?? normalized;
  const direct = LOCALE_ACTIONS[primary];
  if (direct) {
    return { action: direct, locale: primary, known: true };
  }

  const parts = primary.split("-");
  const region = parts.length > 1 ? parts[parts.length - 1] : primary;
  const byRegion = LOCALE_ACTIONS[region];
  if (byRegion) {
    return { action: byRegion, locale: region, known: true };
  }

  return {
    action: UNKNOWN_EMERGENCY_ACTION,
    locale: "unknown",
    known: false,
  };
}
