import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
const API = process.env.TEST_API_URL ?? "http://127.0.0.1:8000";

test("customer registers, chooses a manual point and signs out", async ({
  page,
  request,
}) => {
  const email = `ui-customer-${randomUUID()}@example.com`;
  const password = `Synthetic-${randomUUID()}`;
  try {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await page.getByLabel("Name", { exact: true }).fill("Synthetic customer");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Around your meeting point" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Use current location", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "Location permission is off",
    );
    await page.getByLabel("Meeting latitude").fill("13.0827");
    await page.getByLabel("Meeting longitude").fill("80.2707");
    await page.getByLabel("Meeting label").fill("Public test entrance");
    await page.getByRole("button", { name: "Set meeting point" }).click();
    await expect(
      page.getByText("Public test entrance", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("No available vendors nearby.")).toBeVisible();
    await page.getByRole("button", { name: "Show map", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Nearby map", exact: true }),
    ).toBeVisible();
    await expect
      .poll(() => page.locator(".leaflet-tile-loaded").count(), {
        timeout: 15000,
      })
      .toBeGreaterThan(0);
    await page
      .getByRole("region", { name: "Nearby map", exact: true })
      .screenshot({
        path: ".superpowers/sdd/2026-11-02-applications/customer-map-live.png",
      });
    await page.getByRole("button", { name: "Show list", exact: true }).click();
    await page.screenshot({
      path: ".superpowers/sdd/2026-11-02-applications/customer-nearby-live.png",
      fullPage: true,
    });
    await page.getByRole("link", { name: "Account", exact: true }).click();
    await page
      .getByRole("button", { name: "Enable notifications", exact: true })
      .click();
    await expect(
      page.getByText(
        "Remote notifications are unavailable in this preview. Check Visits for updates.",
        { exact: true },
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
  } finally {
    // Clean up synthetic accounts without printing their password or session.
    const login = await request.post(`${API}/api/v1/auth/login`, {
      data: { email, password },
    });
    if (login.ok()) {
      const tokens = await login.json();
      const deleted = await request.delete(`${API}/api/v1/users/me`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        data: { confirmation: "DELETE" },
      });
      expect(deleted.ok()).toBeTruthy();
    }
  }
});

test("customer registration explains a short password before sending it", async ({
  page,
}) => {
  let registrations = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/v1/auth/register/customer"))
      registrations++;
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Synthetic customer");
  await page.getByLabel("Email", { exact: true }).fill("synthetic@example.com");
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("15 to 128 characters");
  expect(registrations).toBe(0);
});

test("account deletion needs typed confirmation and revokes the account", async ({
  page,
  request,
}) => {
  const email = `ui-delete-${randomUUID()}@example.com`,
    password = `Synthetic-${randomUUID()}`;
  const registered = await request.post(
    `${API}/api/v1/auth/register/customer`,
    { data: { email, password, display_name: "Synthetic deletion" } },
  );
  expect(registered.status()).toBe(201);
  try {
    await page.goto("/");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("link", { name: "Account", exact: true }).click();
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
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
    const rejected = await request.post(`${API}/api/v1/auth/login`, {
      data: { email, password },
    });
    expect(rejected.status()).toBe(401);
  } finally {
    const login = await request.post(`${API}/api/v1/auth/login`, {
      data: { email, password },
    });
    if (login.ok()) {
      const tokens = await login.json();
      await request.delete(`${API}/api/v1/users/me`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        data: { confirmation: "DELETE" },
      });
    }
  }
});
