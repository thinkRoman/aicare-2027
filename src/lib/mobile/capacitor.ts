/**
 * Capacitor runtime helpers.
 * Native packaging wraps Next.js; secrets and health data stay on the server.
 * Never write API keys, BYOK credentials, or encounter health data to
 * Capacitor Preferences or other unencrypted device storage.
 */

import { Capacitor } from "@capacitor/core";

export function isNativeCapacitorRuntime(): boolean {
  return Capacitor.isNativePlatform();
}

export function getCapacitorPlatform(): string {
  return Capacitor.getPlatform();
}

/** Explicitly banned storage targets for credentials and health data. */
export const FORBIDDEN_DEVICE_SECRET_STORES = [
  "Preferences",
  "localStorage",
  "sessionStorage",
] as const;
