import { expect, test } from "./test";
import {
  API,
  account,
  availableVendor,
  pendingVendor,
  operatorAccount,
} from "./fixtures";

for (const [status, message] of [
  ["PENDING", "Your business needs staff approval before going online."],
  [
    "REJECTED",
    "Your business was not approved. Update your profile and request another review.",
  ],
  [
    "SUSPENDED",
    "Your business is suspended. Contact the operator before sharing again.",
  ],
  ["VERIFIED", "Your shop is approved. Open Home to go online."],
] as const) {
  test(`My shop explains ${status.toLowerCase()} approval and its next step`, async ({
    page,
    request,
  }) => {
    const vendor = await pendingVendor(request);
    if (status !== "PENDING") {
      const staff = await operatorAccount(request);
      const decision = await request.post(
        `${API}/api/v1/admin/vendors/${vendor.id}/${status === "SUSPENDED" ? "suspension" : "verification"}`,
        {
          headers: staff.headers,
          data:
            status === "SUSPENDED"
              ? { reason: "Synthetic design review state." }
              : { decision: status, reason: "Synthetic design review state." },
        },
      );
      expect(decision.ok()).toBeTruthy();
    }
    await page.goto("http://127.0.0.1:8082");
    await page.getByLabel("Email", { exact: true }).fill(vendor.email);
    await page.getByLabel("Password", { exact: true }).fill(vendor.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("link", { name: "My shop", exact: true }).click();
    await expect(page.getByText(message, { exact: true })).toBeVisible();
  });
}

test("vendor separates new requests from active and past visits without losing records", async ({
  page,
  request,
}) => {
  const vendor = await availableVendor(request);
  const visits = [];
  for (let index = 0; index < 2; index++) {
    const customer = await account(request, "customer");
    const created = await request.post(`${API}/api/v1/requests`, {
      headers: { ...customer.headers, "Idempotency-Key": crypto.randomUUID() },
      data: {
        vendor_id: vendor.id,
        meeting_point: { latitude: 13.0827, longitude: 80.2707 },
        meeting_label: "Synthetic public meeting",
      },
    });
    expect(created.status()).toBe(201);
    visits.push(await created.json());
  }
  const accepted = await request.post(
    `${API}/api/v1/requests/${visits[0].id}/accept`,
    { headers: vendor.headers, data: { expected_version: visits[0].version } },
  );
  expect(accepted.ok()).toBeTruthy();
  await page.goto("http://127.0.0.1:8082");
  await page.getByLabel("Email", { exact: true }).fill(vendor.email);
  await page.getByLabel("Password", { exact: true }).fill(vendor.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("link", { name: "Customers", exact: true }).click();
  await page.getByRole("button", { name: "New", exact: true }).click();
  await expect(page.locator(`a[href="/visit/${visits[1].id}"]`)).toBeVisible();
  await expect(page.locator(`a[href="/visit/${visits[0].id}"]`)).toHaveCount(0);
  await page.getByRole("button", { name: "Active", exact: true }).click();
  await expect(page.locator(`a[href="/visit/${visits[0].id}"]`)).toBeVisible();
  await expect(page.locator(`a[href="/visit/${visits[1].id}"]`)).toHaveCount(0);
  await page.getByRole("button", { name: "Past", exact: true }).click();
  await expect(
    page.getByText("No past visits in the loaded results.", { exact: true }),
  ).toBeVisible();
});

test("visit help explains server-checked arrival and troubleshooting", async ({
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
  await page.goto("http://127.0.0.1:8082");
  await page.getByLabel("Email", { exact: true }).fill(vendor.email);
  await page.getByLabel("Password", { exact: true }).fill(vendor.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("link", { name: "Customers", exact: true }).click();
  await page.getByRole("link", { name: "View visit", exact: true }).click();
  await page
    .getByRole("button", { name: "Need help with this visit?", exact: true })
    .click();
  await expect(
    page.getByText(
      "Arrival needs two accurate server-received location fixes at least five seconds apart near the meeting point.",
      { exact: true },
    ),
  ).toBeVisible();
});
