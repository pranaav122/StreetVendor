import { expect, test } from "./test";
import { API, account, availableVendor, operatorAccount } from "./fixtures";
const admin = "http://127.0.0.1:3000";

test("staff inspects a reported visit, cancels it with a reason and resolves the report", async ({
  page,
  request,
}) => {
  const vendor = await availableVendor(request),
    customer = await account(request, "customer"),
    operator = await operatorAccount(request);
  const created = await request.post(`${API}/api/v1/requests`, {
    headers: { ...customer.headers, "Idempotency-Key": crypto.randomUUID() },
    data: {
      vendor_id: vendor.id,
      meeting_point: { latitude: 13.0827, longitude: 80.2707 },
      meeting_label: "Synthetic support entrance",
    },
  });
  expect(created.status()).toBe(201);
  const visit = await created.json();
  const submitted = await request.post(
    `${API}/api/v1/requests/${visit.id}/reports`,
    {
      headers: customer.headers,
      data: {
        category: "OTHER",
        reason: "Synthetic support report for the operator browser flow.",
      },
    },
  );
  expect(submitted.status()).toBe(201);
  const report = await submitted.json();
  await page.goto(admin);
  await page.getByLabel("Email", { exact: true }).fill(operator.email);
  await page.getByLabel("Password", { exact: true }).fill(operator.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Reports", exact: true }).click();
  const card = page.getByRole("article", {
    name: `Report ${report.id}`,
    exact: true,
  });
  await expect(
    card.getByText("Synthetic support report for the operator browser flow.", {
      exact: true,
    }),
  ).toBeVisible();
  await card
    .getByRole("button", { name: "Inspect visit", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Visit inspection", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Visit status: PENDING", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Cancellation reason", exact: true })
    .fill("Synthetic operator cancellation after a support report.");
  await page.getByRole("button", { name: "Cancel visit", exact: true }).click();
  await expect(
    page.getByText("Visit status: CANCELLED", { exact: true }),
  ).toBeVisible();
  const cancelled = await request.get(`${API}/api/v1/requests/${visit.id}`, {
    headers: customer.headers,
  });
  expect((await cancelled.json()).status).toBe("CANCELLED");
  await page.getByRole("button", { name: "Reports", exact: true }).click();
  await card
    .getByRole("textbox", { name: "Resolution reason", exact: true })
    .fill("Synthetic report checked and visit cancelled for support.");
  await card
    .getByRole("button", { name: "Resolve report", exact: true })
    .click();
  await expect(
    page.getByText("Report resolved.", { exact: true }),
  ).toBeVisible();
  const resolved = await request.get(
    `${API}/api/v1/admin/reports?status=RESOLVED`,
    { headers: operator.headers },
  );
  expect(
    (await resolved.json()).items.some(
      (row: { id: string }) => row.id === report.id,
    ),
  ).toBe(true);
});

test("staff suspends and restores an account while self-suspension keeps the console authorized", async ({
  page,
  request,
}) => {
  const vendor = await availableVendor(request),
    operator = await operatorAccount(request);
  const owner = await (
    await request.get(`${API}/api/v1/users/me`, { headers: vendor.headers })
  ).json();
  const staff = await (
    await request.get(`${API}/api/v1/users/me`, { headers: operator.headers })
  ).json();
  await page.goto(admin);
  await page.getByLabel("Email", { exact: true }).fill(operator.email);
  await page.getByLabel("Password", { exact: true }).fill(operator.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("button", { name: "Account controls", exact: true })
    .click();
  await page.getByLabel("Account ID", { exact: true }).fill(owner.id);
  await page
    .getByRole("textbox", { name: "Account reason", exact: true })
    .fill("Synthetic account suspension for the browser workflow.");
  await page
    .getByRole("button", { name: "Suspend account", exact: true })
    .click();
  await expect(
    page.getByText("Last confirmed account status: SUSPENDED", { exact: true }),
  ).toBeVisible();
  expect(
    (
      await request.get(`${API}/api/v1/users/me`, { headers: vendor.headers })
    ).status(),
  ).toBe(401);
  await page
    .getByRole("textbox", { name: "Account reason", exact: true })
    .fill("Restoring the synthetic account after a staff check.");
  await page
    .getByRole("button", { name: "Restore account", exact: true })
    .click();
  await expect(
    page.getByText("Last confirmed account status: ACTIVE", { exact: true }),
  ).toBeVisible();
  const login = await request.post(`${API}/api/v1/auth/login`, {
    data: { email: vendor.email, password: vendor.password },
  });
  expect(login.ok()).toBeTruthy();
  const tokens = await login.json();
  const profile = await request.get(`${API}/api/v1/vendors/me`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  expect((await profile.json()).is_available).toBe(false);
  await page.getByLabel("Account ID", { exact: true }).fill(staff.id);
  await page
    .getByRole("textbox", { name: "Account reason", exact: true })
    .fill("Synthetic self suspension must be rejected by the server.");
  await page
    .getByRole("button", { name: "Suspend account", exact: true })
    .click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Another operator",
  );
  await expect(
    page.getByRole("heading", { name: "Operator console", exact: true }),
  ).toBeVisible();
});

test("staff cancellation reloads a competing committed visit version", async ({
  page,
  request,
}) => {
  const vendor = await availableVendor(request),
    customer = await account(request, "customer"),
    operator = await operatorAccount(request);
  const created = await request.post(`${API}/api/v1/requests`, {
    headers: { ...customer.headers, "Idempotency-Key": crypto.randomUUID() },
    data: {
      vendor_id: vendor.id,
      meeting_point: { latitude: 13.0827, longitude: 80.2707 },
    },
  });
  const visit = await created.json();
  await page.goto(admin);
  await page.getByLabel("Email", { exact: true }).fill(operator.email);
  await page.getByLabel("Password", { exact: true }).fill(operator.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("button", { name: "Visit inspection", exact: true })
    .click();
  await page.getByLabel("Visit ID", { exact: true }).fill(visit.id);
  await page
    .getByRole("button", { name: "Inspect visit", exact: true })
    .click();
  await expect(
    page.getByText("Visit status: PENDING", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Cancellation reason", exact: true })
    .fill("Synthetic conflicting staff cancellation attempt.");
  await page.route(
    `${admin}/api/backend/admin/requests/${visit.id}/cancel`,
    async (route) => {
      const accepted = await request.post(
        `${API}/api/v1/requests/${visit.id}/accept`,
        { headers: vendor.headers, data: { expected_version: visit.version } },
      );
      expect(accepted.ok()).toBeTruthy();
      await route.continue();
    },
  );
  await page.getByRole("button", { name: "Cancel visit", exact: true }).click();
  await expect(
    page
      .locator("main")
      .getByRole("alert")
      .filter({ hasText: "The request has changed" }),
  ).toBeVisible();
  await expect(
    page.getByText("Visit status: ACCEPTED", { exact: true }),
  ).toBeVisible();
});
