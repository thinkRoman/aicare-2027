/**
 * User-facing permission fallbacks.
 * Camera and microphone access are requested only after the user activates
 * the related control. Denied access must never block triage typing.
 */

export const CAMERA_PERMISSION_DENIED_MESSAGE =
  "Camera access was denied or unavailable. You can continue without a photo, or enable camera access in device settings and try again." as const;

export const MICROPHONE_PERMISSION_DENIED_MESSAGE =
  "Microphone access was denied or unavailable. You can keep typing your symptoms instead." as const;

export function isPermissionDeniedError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message).toLowerCase() : "";
  return (
    name === "NotAllowedError" ||
    name === "PermissionDeniedError" ||
    message.includes("permission") ||
    message.includes("not allowed") ||
    message.includes("denied")
  );
}
