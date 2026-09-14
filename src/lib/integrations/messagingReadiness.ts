/**
 * Email and WhatsApp remain inactive unless explicitly configured AND authorized.
 * Reserved env vars alone do not activate outbound messaging.
 */

type EnvLike = Record<string, string | undefined>;

export function isEmailIntegrationActive(
  env: EnvLike = process.env,
): boolean {
  return (
    env.EMAIL_INTEGRATION_AUTHORIZED === "true" &&
    Boolean(env.RESEND_API_KEY?.trim()) &&
    Boolean(env.EMAIL_SENT_FROM?.trim())
  );
}

export function isWhatsAppIntegrationActive(
  env: EnvLike = process.env,
): boolean {
  return (
    env.WHATSAPP_INTEGRATION_AUTHORIZED === "true" &&
    Boolean(env.WHATSAPP_PHONE_NUMBER_ID?.trim()) &&
    Boolean(env.WHATSAPP_ACCESS_TOKEN?.trim())
  );
}
