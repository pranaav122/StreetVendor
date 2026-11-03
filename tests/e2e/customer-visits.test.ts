import { expect, test } from "@playwright/test";
import { API, account, availableVendor, fix } from "./fixtures";

test("customer requests a visit, tracks acceptance and loses tracking at completion", async ({
  page,
  request,
}) => {
  const vendor = await availableVendor(request),
    customer = await account(request, "customer");
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(customer.email);
  await page.getByLabel("Password", { exact: true }).fill(customer.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Meeting latitude").fill("13.0827");
  await page.getByLabel("Meeting longitude").fill("80.2707");
  await page.getByLabel("Meeting label").fill("Synthetic market entrance");
  await page.getByRole("button", { name: "Set meeting point" }).click();
  await page
    .getByRole("link", { name: `View ${vendor.name}`, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: vendor.name, exact: true }),
  ).toBeVisible();
  const created = page.waitForResponse(
    (response) =>
      response.url() === `${API}/api/v1/requests` &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Request visit", exact: true })
    .click();
  const response = await created;
  expect(response.status()).toBe(201);
  expect(response.request().headers()["idempotency-key"]).toMatch(
    /^[0-9a-f-]{36}$/,
  );
  const visit = await response.json();
  await expect(
    page.getByRole("heading", { name: "Visit pending", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Vendor location is available.", { exact: true }),
  ).toHaveCount(0);
  const accepted = await request.post(
    `${API}/api/v1/requests/${visit.id}/accept`,
    { headers: vendor.headers, data: { expected_version: visit.version } },
  );
  expect(accepted.ok()).toBeTruthy();
  await expect(
    page.getByRole("heading", { name: "Visit accepted", exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByText("Vendor location is available.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Show tracking map", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Visit tracking map", exact: true }),
  ).toBeVisible();
  const first = await request.put(`${API}/api/v1/vendors/me/location`, {
    headers: vendor.headers,
    data: fix(),
  });
  expect(first.ok()).toBeTruthy();
  await new Promise((resolve) => setTimeout(resolve, 6000));
  const second = await request.put(`${API}/api/v1/vendors/me/location`, {
    headers: vendor.headers,
    data: fix(),
  });
  expect(second.ok()).toBeTruthy();
  const arrived = await request.get(`${API}/api/v1/requests/${visit.id}`, {
    headers: vendor.headers,
  });
  const current = await arrived.json();
  expect(current.status).toBe("ARRIVED");
  const completed = await request.post(
    `${API}/api/v1/requests/${visit.id}/complete`,
    { headers: vendor.headers, data: { expected_version: current.version } },
  );
  expect(completed.ok()).toBeTruthy();
  await expect(
    page.getByRole("heading", { name: "Visit completed", exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByText("Vendor location is available.", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Visit tracking map", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Report details")
    .fill("Synthetic report to verify participant reporting.");
  await page.getByRole("button", { name: "Send report", exact: true }).click();
  await expect(page.getByText("Report sent.", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Visits", exact: true }).click();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(
    page.getByText(vendor.name, { exact: true }).filter({ visible: true }),
  ).toBeVisible();
});

test("customer can cancel a pending visit only after entering a reason", async ({
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
      meeting_label: "Synthetic public entrance",
    },
  });
  expect(created.status()).toBe(201);
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(customer.email);
  await page.getByLabel("Password", { exact: true }).fill(customer.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("link", { name: "Visits", exact: true }).click();
  await page.getByRole("link", { name: "View visit", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Cancel visit", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Cancellation reason")
    .fill("Synthetic change of plans");
  await page.getByRole("button", { name: "Cancel visit", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Visit cancelled", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Vendor location is available.", { exact: true }),
  ).toHaveCount(0);
});
