/**
 * Strips common identifying information from free-text intake before AI invocation.
 *
 * Gate 6 privacy note: this is best-effort pattern redaction only.
 * It is not complete de-identification, not HIPAA Safe Harbor, and not a
 * substitute for clinical data governance. Residual PII may remain.
 */
export function stripCommonPii(text: string): string {
  let result = text;

  // Emails
  result = result.replace(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    "[REDACTED_EMAIL]",
  );

  // US-style phone numbers
  result = result.replace(
    /(?<!\w)(?:\+?1[-.\s]*)?(?:\(?\d{3}\)?[-.\s]*)\d{3}[-.\s]*\d{4}(?!\w)/g,
    "[REDACTED_PHONE]",
  );

  // SSN-like patterns
  result = result.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED_SSN]");

  // Payment-card-like sequences (13–19 digits with optional separators)
  result = result.replace(
    /\b(?:\d[ -]*?){13,19}\b/g,
    "[REDACTED_CARD]",
  );

  // Simple street address lines
  result = result.replace(
    /\b\d{1,6}\s+[A-Za-z0-9.'-]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct)\b\.?/gi,
    "[REDACTED_ADDRESS]",
  );

  return result;
}
