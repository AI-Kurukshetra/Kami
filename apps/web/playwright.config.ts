import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import { resolve } from 'node:path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '../../.env.local') });

const webServerEnv = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
);

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3005',
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'rm -f .next/dev/lock && npm run dev -- --port 3005',
    port: 3005,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      ...webServerEnv
    }
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
