import { expect, test } from "@playwright/test";
import { API, account, availableVendor, fix } from "./fixtures";
test("a concurrent partner decision shows a conflict and reloads server state", async ({
  page,
  request,
}) => {
  const vendor = await availableVendor(request),
    customer = await account(request, "customer");
  const created = await request.post(`${API}/api/v1/requests`, {
    headers: { ...customer.headers, "Idempotency-Key": crypto.randomUUID() },
    data: {
      vendor_id: vendor.id,
      meeting_point: { latitude: 13.0827, longitude: 80.2707 },
    },
  });
  expect(created.status()).toBe(201);
  const visit = await created.json();
  await page.goto("http://127.0.0.1:8082");
  await page.getByLabel("Email", { exact: true }).fill(vendor.email);
  await page.getByLabel("Password", { exact: true }).fill(vendor.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("link", { name: "Visits", exact: true }).click();
  await page.getByRole("link", { name: "View visit", exact: true }).click();
  await page
    .getByLabel("Reason", { exact: true })
    .fill("Synthetic competing decision");
  await page.route(
    `${API}/api/v1/requests/${visit.id}/decline`,
    async (route) => {
      // Both decisions reach the real API; hold this one until another session commits.
      const accepted = await request.post(
        `${API}/api/v1/requests/${visit.id}/accept`,
        { headers: vendor.headers, data: { expected_version: visit.version } },
      );
      expect(accepted.ok()).toBeTruthy();
      await route.continue();
    },
  );
  await page
    .getByRole("button", { name: "Decline visit", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "The request has changed" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Visit accepted", exact: true }),
  ).toBeVisible();
  const stored = await request.get(`${API}/api/v1/requests/${visit.id}`, {
    headers: customer.headers,
  });
  expect((await stored.json()).status).toBe("ACCEPTED");
});
test("partner accepts a real visit, progresses through arrival and finds completion in history", async ({
  page,
  request,
}) => {
  const vendor = await availableVendor(request),
    customer = await account(request, "customer");
  const created = await request.post(`${API}/api/v1/requests`, {
    headers: { ...customer.headers, "Idempotency-Key": crypto.randomUUID() },
    data: {
      vendor_id: vendor.id,
      meeting_point: { latitude: 13.0827, longitude: 80.2707 },
      meeting_label: "Synthetic public market",
    },
  });
  expect(created.status()).toBe(201);
  const visit = await created.json();
  await page.goto("http://127.0.0.1:8082");
  await page.getByLabel("Email", { exact: true }).fill(vendor.email);
  await page.getByLabel("Password", { exact: true }).fill(vendor.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("link", { name: "Visits", exact: true }).click();
  await page.getByRole("link", { name: "View visit", exact: true }).click();
  await page.getByRole("button", { name: "Accept visit", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Visit accepted", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Open meeting point in maps",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mark approaching", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Visit approaching", exact: true }),
  ).toBeVisible();
  expect(
    (
      await request.put(`${API}/api/v1/vendors/me/location`, {
        headers: vendor.headers,
        data: fix(),
      })
    ).ok(),
  ).toBeTruthy();
  await new Promise((resolve) => setTimeout(resolve, 6000));
  expect(
    (
      await request.put(`${API}/api/v1/vendors/me/location`, {
        headers: vendor.headers,
        data: fix(),
      })
    ).ok(),
  ).toBeTruthy();
  await expect(
    page.getByRole("button", { name: "Complete visit", exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await page
    .getByRole("button", { name: "Complete visit", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Visit completed", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Open meeting point in maps",
      exact: true,
    }),
  ).toHaveCount(0);
  const stored = await request.get(`${API}/api/v1/requests/${visit.id}`, {
    headers: customer.headers,
  });
  expect((await stored.json()).status).toBe("COMPLETED");
  await page.getByRole("link", { name: "Visits", exact: true }).click();
  await page
    .getByRole("button", { name: "History", exact: true })
    .last()
    .click();
  await expect(
    page.getByText("COMPLETED", { exact: false }).filter({ visible: true }),
  ).toBeVisible();
});

test("partner decline requires a reason and persists the decision", async ({
  page,
  request,
}) => {
  const vendor = await availableVendor(request),
    customer = await account(request, "customer");
  const created = await request.post(`${API}/api/v1/requests`, {
    headers: { ...customer.headers, "Idempotency-Key": crypto.randomUUID() },
    data: {
      vendor_id: vendor.id,
      meeting_point: { latitude: 13.0827, longitude: 80.2707 },
      meeting_label: "Synthetic entrance",
    },
  });
  const visit = await created.json();
  await page.goto("http://127.0.0.1:8082");
  await page.getByLabel("Email", { exact: true }).fill(vendor.email);
  await page.getByLabel("Password", { exact: true }).fill(vendor.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("link", { name: "Visits", exact: true }).click();
  await page.getByRole("link", { name: "View visit", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Decline visit", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Reason", { exact: true })
    .fill("Synthetic stall closing soon");
  await page
    .getByRole("button", { name: "Decline visit", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Visit declined", exact: true }),
  ).toBeVisible();
  const stored = await request.get(`${API}/api/v1/requests/${visit.id}`, {
    headers: customer.headers,
  });
  const row = await stored.json();
  expect(row.status).toBe("DECLINED");
  expect(row.reason).toBe("Synthetic stall closing soon");
});
