// Playwright E2E configuration: runs the PRD §14 acceptance flows (tests/e2e/) against a
// mock-mode server on port 3000. workers=1 + ordered spec files because the daily build
// quota is in-process memory state (docs/TEST-STRATEGY.md §2). Chromium only by decision.
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 90_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Reuses an already-running server on 3000 (e.g. a production `next start`) when present;
  // otherwise boots the dev server. CI always gets a fresh server.
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
