import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "test/browser",
  timeout: 40000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5178",
    viewport: { width: 1360, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npx vite --config demo/vite.config.ts",
      url: "http://127.0.0.1:5179",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npx vite --config test/fixture/vite.config.ts",
      url: "http://127.0.0.1:5178",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
