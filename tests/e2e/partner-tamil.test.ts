import { resolve } from "node:path";
import { expect, test } from "./test";
import { API, availableVendor } from "./fixtures";
import type { Page } from "@playwright/test";

async function expectNavigationLabelsToFit(page: Page): Promise<void> {
  const overflowing = await page
    .getByRole("navigation")
    .getByRole("link")
    .evaluateAll((links) =>
      links.flatMap((link) => {
        const label = link.querySelector('[dir="auto"]');
        if (!label) return ["Missing navigation label"];
        const buttonBounds = link.getBoundingClientRect();
        const labelBounds = label.getBoundingClientRect();
        return labelBounds.left < buttonBounds.left - 1 ||
          labelBounds.right > buttonBounds.right + 1
          ? [link.textContent?.trim() ?? "Unnamed destination"]
          : [];
      }),
    );
  expect(overflowing).toEqual([]);
}
test("Partner Tamil controls wrap at phone width and preserve the business name", async ({
  page,
  request,
}) => {
  const vendor = await availableVendor(request);
  const changed = await request.patch(`${API}/api/v1/users/me`, {
    headers: vendor.headers,
    data: { preferred_language: "ta" },
  });
  expect(changed.ok()).toBeTruthy();
  await page.goto("http://127.0.0.1:8082");
  await page.getByLabel("Email", { exact: true }).fill(vendor.email);
  await page.getByLabel("Password", { exact: true }).fill(vendor.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: vendor.name, exact: true }),
  ).toBeVisible();

  const online = page.getByRole("button", {
    name: "ஆன்லைனில் செல்லவும்",
    exact: true,
  });
  await expect(online).toBeVisible();
  const box = await online.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(52);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await expectNavigationLabelsToFit(page);
  await page.screenshot({
    path: resolve(
      ".superpowers/sdd/2026-11-02-applications/partner-tamil-live.png",
    ),
    fullPage: true,
  });
  // Double rendered text sizes without changing production styles or device permissions.
  await page.evaluate(() => {
    const text = [
      ...document.querySelectorAll<HTMLElement>('[dir="auto"]'),
    ].map((node) => {
      const style = getComputedStyle(node);
      return {
        node,
        size: parseFloat(style.fontSize),
        line: parseFloat(style.lineHeight),
      };
    });
    for (const { node, size, line } of text) {
      node.style.fontSize = `${size * 2}px`;
      if (Number.isFinite(line)) node.style.lineHeight = `${line * 2}px`;
    }
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await expect(
    page.getByRole("navigation", { name: "முதன்மை வழிசெலுத்தல்" }),
  ).toBeVisible();
  await expect(online).toBeVisible();
  await expectNavigationLabelsToFit(page);
  await page.screenshot({
    path: resolve(
      ".superpowers/sdd/2026-11-05-simple-mobile-ui/partner-tamil-large-live.png",
    ),
    fullPage: true,
  });
});
