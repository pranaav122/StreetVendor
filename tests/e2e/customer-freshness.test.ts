import { expect, test } from "./test";
import { API, account, availableVendor } from "./fixtures";
test("nearby refresh removes a vendor who stopped sharing", async ({
  page,
  request,
}) => {
  const vendor = await availableVendor(request),
    customer = await account(request, "customer");
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(customer.email);
  await page.getByLabel("Password", { exact: true }).fill(customer.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("button", { name: "Enter coordinates", exact: true })
    .click();
  await page.getByLabel("Meeting latitude").fill("13.0827");
  await page.getByLabel("Meeting longitude").fill("80.2707");
  await page.getByLabel("Meeting label").fill("Synthetic public market");
  await page
    .getByRole("button", { name: "Set meeting point", exact: true })
    .click();
  await expect(page.getByText(vendor.name, { exact: true })).toBeVisible();
  await page.waitForLoadState("networkidle");
  const offline = await request.patch(`${API}/api/v1/vendors/me/availability`, {
    headers: vendor.headers,
    data: { is_available: false, location_sharing_enabled: false },
  });
  expect(offline.ok()).toBeTruthy();
  await expect(page.getByText(vendor.name, { exact: true })).toHaveCount(0, {
    timeout: 40000,
  });
  await expect(
    page.getByText("No available vendors nearby.", { exact: true }),
  ).toBeVisible();
});
