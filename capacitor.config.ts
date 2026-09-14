import type { CapacitorConfig } from "@capacitor/cli";
import {
  assertCapacitorServerUrlSafeForProduction,
  resolveCapacitorServerUrl,
} from "./src/lib/mobile/capacitorServerUrl";

/**
 * Capacitor wraps the existing Next.js App Router app.
 * It does not replace Next.js or use static export.
 *
 * Native shells load the running/deployed Next.js origin via `server.url`.
 * `webDir` holds a minimal placeholder only so Capacitor CLI can sync;
 * browser users continue to use Next.js directly.
 */
const serverUrl = resolveCapacitorServerUrl();
assertCapacitorServerUrlSafeForProduction(serverUrl);

const config: CapacitorConfig = {
  appId: "com.thinkroman.aicare",
  appName: "aiCARE",
  webDir: "capacitor/www",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
    androidScheme: "https",
  },
  plugins: {
    Camera: {
      // Permission copy for native packaging. Runtime prompts occur only after
      // the user opens the photo flow.
      permissions: {
        camera: "aiCARE uses the camera only when you choose to add a photo.",
        photos:
          "aiCARE may access photos you select to describe a health concern.",
      },
    },
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
  },
  android: {
    allowMixedContent: serverUrl.startsWith("http://"),
  },
};

export default config;
