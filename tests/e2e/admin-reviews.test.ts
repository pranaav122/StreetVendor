import { expect, test } from "./test";
import { API, fix, operatorAccount, pendingVendor } from "./fixtures";
const admin = "http://127.0.0.1:3000";

test("staff reviews public business details, approves, suspends and returns the business to pending", async ({
  page,
  request,
}) => {
  const vendor = await pendingVendor(request),
    operator = await operatorAccount(request);
  await page.goto(admin);
  await page.getByLabel("Email", { exact: true }).fill(operator.email);
  await page.getByLabel("Password", { exact: true }).fill(operator.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const card = page.getByRole("article", { name: vendor.name, exact: true });
  await expect(card).toBeVisible();
  await card
    .getByRole("button", { name: "View business details", exact: true })
    .click();
  await expect(
    card.getByText("Synthetic local produce for browser checks.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    card.getByRole("button", { name: "Approve business", exact: true }),
  ).toBeDisabled();
  await card
    .getByLabel("Review reason", { exact: true })
    .fill("Checked the synthetic public stall and its categories.");
  await card
    .getByRole("button", { name: "Approve business", exact: true })
    .click();
  await expect(
    page.getByText("Review saved: VERIFIED.", { exact: true }),
  ).toBeVisible();
  const approved = await request.get(`${API}/api/v1/vendors/me`, {
    headers: vendor.headers,
  });
  expect((await approved.json()).verification_status).toBe("VERIFIED");
  expect(
    (
      await request.patch(`${API}/api/v1/vendors/me/availability`, {
        headers: vendor.headers,
        data: {
          is_available: true,
          location_sharing_enabled: true,
          location: fix(),
        },
      })
    ).ok(),
  ).toBeTruthy();
  await page
    .getByRole("button", { name: "Business controls", exact: true })
    .click();
  await page.getByLabel("Business ID", { exact: true }).fill(vendor.id);
  await page
    .getByRole("textbox", { name: "Action reason", exact: true })
    .fill("Synthetic business suspension for the browser workflow.");
  await page
    .getByRole("button", { name: "Suspend business", exact: true })
    .click();
  await expect(
    page.getByText("Last confirmed business status: SUSPENDED", {
      exact: true,
    }),
  ).toBeVisible();
  const suspended = await request.get(`${API}/api/v1/vendors/me`, {
    headers: vendor.headers,
  });
  const row = await suspended.json();
  expect(row.verification_status).toBe("SUSPENDED");
  expect(row.is_available).toBe(false);
  expect(row.location_sharing_enabled).toBe(false);
  await page
    .getByRole("textbox", { name: "Action reason", exact: true })
    .fill("Returning the synthetic business for a separate staff review.");
  await page
    .getByRole("button", { name: "Return business to review", exact: true })
    .click();
  await expect(
    page.getByText("Last confirmed business status: PENDING", { exact: true }),
  ).toBeVisible();
  const pending = await request.get(`${API}/api/v1/vendors/me`, {
    headers: vendor.headers,
  });
  expect((await pending.json()).is_available).toBe(false);
});

test("staff can reject a pending business with a recorded reason", async ({
  page,
  request,
}) => {
  const vendor = await pendingVendor(request),
    operator = await operatorAccount(request);
  await page.goto(admin);
  await page.getByLabel("Email", { exact: true }).fill(operator.email);
  await page.getByLabel("Password", { exact: true }).fill(operator.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const card = page.getByRole("article", { name: vendor.name, exact: true });
  await card
    .getByLabel("Review reason", { exact: true })
    .fill("Synthetic public business details need clarification.");
  await card
    .getByRole("button", { name: "Reject business", exact: true })
    .click();
  await expect(
    page.getByText("Review saved: REJECTED.", { exact: true }),
  ).toBeVisible();
  const profile = await request.get(`${API}/api/v1/vendors/me`, {
    headers: vendor.headers,
  });
  expect((await profile.json()).verification_status).toBe("REJECTED");
});
