import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.{test.ts,test.tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    environmentMatchGlobs: [
      ["src/components/**", "jsdom"],
      ["src/app/settings/**", "jsdom"],
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
