/**
 * Validates CAPACITOR_SERVER_URL for native packaging.
 * Production native builds must not target localhost.
 */

type EnvLike = Record<string, string | undefined>;

export function resolveCapacitorServerUrl(
  env: EnvLike = process.env,
): string {
  const configured = env.CAPACITOR_SERVER_URL?.trim();
  return configured && configured.length > 0
    ? configured
    : "http://localhost:3000";
}

export function assertCapacitorServerUrlSafeForProduction(
  serverUrl: string,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): void {
  if (nodeEnv !== "production") {
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(serverUrl);
  } catch {
    throw new Error(
      "CAPACITOR_SERVER_URL must be a valid absolute URL for production native builds",
    );
  }

  if (parsed.protocol !== "https:") {
    throw new Error(
      "CAPACITOR_SERVER_URL must use https:// for production native builds",
    );
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local")
  ) {
    throw new Error(
      "CAPACITOR_SERVER_URL must not target localhost in production native builds",
    );
  }
}
