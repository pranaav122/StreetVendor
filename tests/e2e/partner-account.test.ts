import { expect, test } from "./test";
import { API, availableVendor } from "./fixtures";
test("Partner account saves a name, reports browser push limits and hides the business on sign-out", async ({
  page,
  request,
}) => {
  const vendor = await availableVendor(request);
  await page.goto("http://127.0.0.1:8082");
  await page.getByLabel("Email", { exact: true }).fill(vendor.email);
  await page.getByLabel("Password", { exact: true }).fill(vendor.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("link", { name: "More", exact: true }).click();
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Synthetic Partner renamed");
  await page.getByRole("button", { name: "Save name", exact: true }).click();
  await expect(page.getByText("Name saved.", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Enable notifications", exact: true })
    .click();
  await expect(
    page.getByText(
      "Remote notifications are unavailable in this preview. Check Customers for updates.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in to your shop", exact: true }),
  ).toBeVisible();
  const profile = await request.get(`${API}/api/v1/vendors/me`, {
    headers: vendor.headers,
  });
  expect((await profile.json()).is_available).toBe(false);
});
test("Partner account deletion requires the phrase and revokes access", async ({
  page,
  request,
}) => {
  const vendor = await availableVendor(request);
  await page.goto("http://127.0.0.1:8082");
  await page.getByLabel("Email", { exact: true }).fill(vendor.email);
  await page.getByLabel("Password", { exact: true }).fill(vendor.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("link", { name: "More", exact: true }).click();
  await page
    .getByRole("button", { name: "Account deletion", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Delete account", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Type DELETE to delete your account", { exact: true })
    .fill("DELETE");
  await page
    .getByRole("button", { name: "Delete account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sign in to your shop", exact: true }),
  ).toBeVisible();
  const denied = await request.get(`${API}/api/v1/users/me`, {
    headers: vendor.headers,
  });
  expect(denied.status()).toBe(401);
});
