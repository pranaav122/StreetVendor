import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  timeout: 90000,
  expect: { timeout: 10000 },
  use: {
    actionTimeout: 10000,
    baseURL: "http://127.0.0.1:8081",
    ...(process.platform === "win32" ? { channel: "msedge" } : {}),
    viewport: { width: 390, height: 844 },
    // Login traffic contains credentials. Do not retain traces or video by default.
    trace: "off",
    video: "off",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command:
        "npm run web --workspace @mystreetvendor/customer-app -- --host localhost",
      url: "http://127.0.0.1:8081",
      timeout: 120000,
      reuseExistingServer: false,
      env: {
        CI: "1",
        BROWSER: "none",
        EXPO_PUBLIC_API_URL:
          process.env.TEST_API_URL ?? "http://127.0.0.1:8000",
      },
    },
    {
      command:
        "npm run web --workspace @mystreetvendor/vendor-app -- --host localhost",
      url: "http://127.0.0.1:8082",
      timeout: 120000,
      reuseExistingServer: false,
      env: {
        CI: "1",
        BROWSER: "none",
        EXPO_PUBLIC_API_URL:
          process.env.TEST_API_URL ?? "http://127.0.0.1:8000",
      },
    },
  ],
});
