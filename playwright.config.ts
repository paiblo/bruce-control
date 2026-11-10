import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  timeout: 30000,
  workers: 1,
  reporter: [["list"], ["json", { outputFile: "test-results/browser.json" }]],
  use: {
    baseURL: "http://127.0.0.1:5173/bruce-control/",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/serve.mjs",
    url: "http://127.0.0.1:5173/bruce-control/",
    reuseExistingServer: true,
  },
  projects: [
    {
      name: "chromium-mobile",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        browserName: "chromium",
        launchOptions: {
          executablePath: process.env.CI ? undefined : "/usr/bin/chromium",
          args: ["--no-sandbox"],
        },
      },
    },
    {
      name: "webkit-mobile",
      use: {
        ...devices["iPhone 13"],
        browserName: "webkit",
        launchOptions: process.env.BRUCE_WEBKIT_EXECUTABLE
          ? { executablePath: process.env.BRUCE_WEBKIT_EXECUTABLE }
          : undefined,
      },
    },
  ],
});
