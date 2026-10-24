import { defineConfig } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

const PORT = 3100;

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
  },
  // Builds the app and starts a fresh server with its own data file for each test run.
  webServer: {
    command: 'npm run build && node server/index.js',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PORT: String(PORT),
      DATA_FILE: path.join(os.tmpdir(), `gjeng-e2e-${Date.now()}.json`),
    },
  },
});
