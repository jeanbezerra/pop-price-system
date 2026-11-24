import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    channel: process.platform === "win32" ? "msedge" : undefined,
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node tests/fixtures/api-server.mjs",
      url: "http://127.0.0.1:3101/health",
      reuseExistingServer: false,
    },
    {
      command: "npm run start -- --port 3100",
      url: "http://127.0.0.1:3100",
      reuseExistingServer: false,
      timeout: 60000,
      env: {
        API_BASE_URL: "http://127.0.0.1:3101/pop-price-system-service",
        API_TIMEOUT_MS: "1000",
        API_DOCS_ENABLED: "true",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
});
