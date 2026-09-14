/**
 * Gate 6 decision: keep `/ios` and `/android` gitignored.
 *
 * Justification:
 * - Native shells are Capacitor-generated packaging artifacts from `capacitor.config.ts`.
 * - Reproducible native builds come from `npx cap add ios|android` + `npm run cap:sync`
 *   against a documented `CAPACITOR_SERVER_URL` (never localhost in production).
 * - Committing platform folders would bloat the repo without adding application logic
 *   and still would not include signing certificates or store credentials.
 * - CI that needs native artifacts should generate and sync them in the pipeline.
 */
export const NATIVE_PLATFORM_FOLDERS_COMMITTED = false as const;

export const NATIVE_PLATFORM_REPRODUCTION = [
  "Set CAPACITOR_SERVER_URL to the deployed Next.js origin (https).",
  "npx cap add ios",
  "npx cap add android",
  "npm run cap:sync",
] as const;
