import { expect, test } from "@playwright/test";
import { API, account } from "./fixtures";

test("remote session revocation removes the signed-in customer interface", async ({
  page,
  request,
}) => {
  const customer = await account(request, "customer");
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(customer.email);
  await page.getByLabel("Password", { exact: true }).fill(customer.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("link", { name: "Visits", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your visits", exact: true }),
  ).toBeVisible();
  const logout = await request.post(`${API}/api/v1/auth/logout-all`, {
    headers: customer.headers,
  });
  expect(logout.status()).toBe(204);
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByRole("heading", { name: "Your visits", exact: true }),
  ).toHaveCount(0);
});
