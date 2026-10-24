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
    // A fake microphone that beeps, so call tests can check that sound really reaches the other person.
    permissions: ['microphone'],
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
    },
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
