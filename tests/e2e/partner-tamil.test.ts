import { resolve } from "node:path";
import { expect, test } from "./test";
import { API, availableVendor } from "./fixtures";
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
    page.getByRole("heading", { name: "இன்றைய உங்கள் வணிகம்", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(vendor.name, { exact: true })).toBeVisible();
  const online = page.getByRole("button", {
    name: "ஆன்லைனில் சென்று இருப்பிடத்தைப் பகிரவும்",
    exact: true,
  });
  await expect(online).toBeVisible();
  const box = await online.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(52);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: resolve(
      ".superpowers/sdd/2026-11-02-applications/partner-tamil-live.png",
    ),
    fullPage: true,
  });
});
