import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",

  // One worker on purpose. With no DATABASE_URL the server is a single
  // in-process store, so parallel workers would be several tests mutating one
  // dataset and reading each other's rows.
  workers: 1,
  fullyParallel: false,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    // The built server, not `nuxt dev`. Route rules, the prerendered marketing
    // page and SSR only behave like production after a real build, and those
    // are the things these journeys are checking.
    command: "npm run build && node .output/server/index.mjs",
    url: baseURL,
    // Never adopt whatever happens to hold port 3000. Reusing it once meant the
    // suite passed against a stale `nuxt dev` server instead of the build above
    // — a green run that proved nothing. Fail loudly on a busy port instead.
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      PORT: "3000",
      // Blanked, not omitted: this env is merged into process.env, so a database
      // URL in the developer's shell would leak in and quietly move the suite
      // off the memory driver it exists to exercise. Empty keeps it on the
      // deterministic seed, so the numbers are the same every run.
      DATABASE_URL: "",
      POSTGRES_URL: "",
      SESSION_SECRET: "forge-desk-e2e-secret"
    }
  }
});
