import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { API } from "./fixtures";

test("partner registers, creates a business and submits minimal review details", async ({
  page,
  request,
}) => {
  const email = `ui-partner-${randomUUID()}@example.com`,
    password = `Synthetic-${randomUUID()}`;
  await page.goto("http://127.0.0.1:8082");
  await page
    .getByRole("button", { name: "Create partner account", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Synthetic partner");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create partner account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your business today", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Profile", exact: true }).click();
  await page
    .getByLabel("Business name", { exact: true })
    .fill("Synthetic fresh produce");
  await page
    .getByLabel("Business description", { exact: true })
    .fill("Seasonal produce for a local browser check.");
  await page.getByRole("button", { name: "Vegetables", exact: true }).click();
  await page
    .getByRole("button", { name: "Save business profile", exact: true })
    .click();
  await expect(
    page.getByText("Business profile saved.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Review details", { exact: true })
    .fill("Staff can check my synthetic stall at the public market.");
  await page
    .getByRole("button", { name: "Request staff review", exact: true })
    .click();
  await expect(
    page.getByText("Review requested.", { exact: true }),
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
