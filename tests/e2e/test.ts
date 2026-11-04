import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { test as base } from "@playwright/test";
export { expect, type APIRequestContext } from "@playwright/test";

export const test = base.extend<{ isolatedCase: void }>({
  isolatedCase: [
    async ({}, use) => {
      if (!process.env.BROWSER_FIXTURE_DB || !process.env.BROWSER_PYTHON)
        throw new Error(
          "Use scripts/Test-Applications.ps1 for isolated UI checks.",
        );
      // Each case gets independent users/businesses and an abuse-counter window.
      // The Python helper refuses non-generated databases before connecting.
      execFileSync(
        process.env.BROWSER_PYTHON,
        [resolve("backend/scripts/browser_fixture.py"), "reset-case"],
        { stdio: "pipe" },
      );
      await use();
    },
    { auto: true },
  ],
});
