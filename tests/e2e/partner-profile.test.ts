import { randomUUID } from "node:crypto";
import { expect, test } from "./test";
import { API } from "./fixtures";

test("partner registers, creates a business and submits minimal review details", async ({
  page,
  request,
}) => {
  const email = `ui-partner-${randomUUID()}@example.com`,
    password = `Synthetic-${randomUUID()}`;
  await page.goto("http://127.0.0.1:8082");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Synthetic partner");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Set up your shop", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Set up my shop", exact: true })
    .click();
  await page
    .getByLabel("Shop name", { exact: true })
    .fill("Synthetic fresh produce");
  await page
    .getByLabel("About your shop", { exact: true })
    .fill("Seasonal produce for a local browser check.");
  await page.getByRole("button", { name: "Vegetables", exact: true }).click();
  await page
    .getByRole("button", { name: "Save shop details", exact: true })
    .click();
  await expect(
    page.getByText("Shop details saved.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Public stall details", { exact: true })
    .fill("Staff can check my synthetic stall at the public market.");
  await page
    .getByRole("button", { name: "Send for approval", exact: true })
    .click();
  await expect(
    page.getByText("Sent for approval.", { exact: true }),
  ).toBeVisible();
  const login = await request.post(`${API}/api/v1/auth/login`, {
    data: { email, password },
  });
  expect(login.ok()).toBeTruthy();
  const tokens = await login.json();
  const profile = await request.get(`${API}/api/v1/vendors/me`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const stored = await profile.json();
  expect(stored.verification_status).toBe("PENDING");
  expect(stored.is_available).toBe(false);
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:8082/");
  // The stack retains the first Home route; assert the newly opened instance.
  await expect(
    page
      .getByText("Your business needs staff approval before going online.", {
        exact: true,
      })
      .last(),
  ).toBeVisible();
});
