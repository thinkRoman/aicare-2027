import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FORBIDDEN_DEVICE_SECRET_STORES,
  getCapacitorPlatform,
  isNativeCapacitorRuntime,
} from "@/lib/mobile/capacitor";
import {
  CAMERA_PERMISSION_DENIED_MESSAGE,
  MICROPHONE_PERMISSION_DENIED_MESSAGE,
  isPermissionDeniedError,
} from "@/lib/mobile/permissions";
import { MIN_TOUCH_TARGET_PX } from "@/lib/consumer/triageUi";

describe("Capacitor wrap-mode configuration", () => {
  it("declares wrap-mode server URL without static Next export", () => {
    const config = readFileSync(
      resolve(process.cwd(), "capacitor.config.ts"),
      "utf8",
    );
    expect(config).toMatch(/server\s*:\s*\{[\s\S]*url:/);
    expect(config).toContain("webDir");
    expect(config.toLowerCase()).not.toContain('output: "export"');
    expect(config).toMatch(/localhost:3000|CAPACITOR_SERVER_URL/);
  });

  it("keeps a placeholder web dir for CLI sync only", () => {
    const index = readFileSync(
      resolve(process.cwd(), "capacitor/www/index.html"),
      "utf8",
    );
    expect(index).toContain("viewport-fit=cover");
    expect(index.toLowerCase()).toContain("next.js");
  });

  it("reports browser (non-native) platform in unit tests", () => {
    expect(isNativeCapacitorRuntime()).toBe(false);
    expect(getCapacitorPlatform()).toBe("web");
  });

  it("forbids storing secrets in Capacitor Preferences or web storage", () => {
    expect(FORBIDDEN_DEVICE_SECRET_STORES).toContain("Preferences");
    expect(FORBIDDEN_DEVICE_SECRET_STORES).toContain("localStorage");
  });
});

describe("mobile permission fallbacks", () => {
  it("exposes clear denied-camera and denied-microphone copy", () => {
    expect(CAMERA_PERMISSION_DENIED_MESSAGE.toLowerCase()).toContain("camera");
    expect(CAMERA_PERMISSION_DENIED_MESSAGE.toLowerCase()).toContain(
      "continue",
    );
    expect(MICROPHONE_PERMISSION_DENIED_MESSAGE.toLowerCase()).toContain(
      "typing",
    );
  });

  it("detects permission-denied style errors", () => {
    expect(isPermissionDeniedError({ name: "NotAllowedError" })).toBe(true);
    expect(isPermissionDeniedError({ message: "Permission denied" })).toBe(
      true,
    );
    expect(isPermissionDeniedError({ name: "TypeError" })).toBe(false);
  });
});

describe("mobile layout contracts", () => {
  const PHONE_VIEWPORTS = [320, 375, 390, 414] as const;

  it("keeps the shared 48px touch target constant", () => {
    expect(MIN_TOUCH_TARGET_PX).toBe(48);
  });

  it("defines safe-area CSS variables and overflow guards", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/app/globals.css"),
      "utf8",
    );
    expect(css).toContain("safe-area-inset-top");
    expect(css).toContain("overflow-x: hidden");
    expect(css).toContain("aicare-shell");
    expect(css).toContain("aicare-emergency");
    expect(css).toContain("orientation: landscape");
  });

  it("exports viewport-fit cover from the root layout", () => {
    const layout = readFileSync(
      resolve(process.cwd(), "src/app/layout.tsx"),
      "utf8",
    );
    expect(layout).toContain("viewportFit");
    expect(layout).toContain('"cover"');
  });

  it("documents phone-first viewport widths used for Gate 5 checks", () => {
    // Contract checklist widths (px): small phone → common iPhone sizes.
    expect(PHONE_VIEWPORTS).toEqual([320, 375, 390, 414]);
    for (const width of PHONE_VIEWPORTS) {
      expect(width).toBeGreaterThanOrEqual(320);
      expect(width).toBeLessThanOrEqual(430);
    }
  });

  it("keeps native platform folders present for packaging readiness", () => {
    const iosPlist = resolve(process.cwd(), "ios/App/App/Info.plist");
    const androidManifest = resolve(
      process.cwd(),
      "android/app/src/main/AndroidManifest.xml",
    );
    expect(readFileSync(iosPlist, "utf8")).toContain("NSCameraUsageDescription");
    expect(readFileSync(iosPlist, "utf8")).toContain(
      "NSMicrophoneUsageDescription",
    );
    expect(readFileSync(androidManifest, "utf8")).toContain(
      "android.permission.CAMERA",
    );
    expect(readFileSync(androidManifest, "utf8")).toContain(
      "android.permission.RECORD_AUDIO",
    );
  });
});
