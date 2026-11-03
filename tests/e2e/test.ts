import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { test as base } from "@playwright/test";
export { expect, type APIRequestContext } from "@playwright/test";

export const test = base.extend<{ isolatedRateLimits: void }>({
  isolatedRateLimits: [
    async ({}, use) => {
      if (!process.env.BROWSER_FIXTURE_DB || !process.env.BROWSER_PYTHON)
        throw new Error(
          "Use scripts/Test-Applications.ps1 for isolated UI checks.",
        );
      // Each test gets a fresh abuse-counter window, while production keeps its
      // unchanged protection. The Python helper refuses non-generated databases.
      execFileSync(
        process.env.BROWSER_PYTHON,
        [resolve("backend/scripts/browser_fixture.py"), "reset-rate-limits"],
        { stdio: "pipe" },
      );
      await use();
    },
    { auto: true },
  ],
});
