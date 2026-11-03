import { expect, test } from "./test";
import { API, account, availableVendor, operatorAccount } from "./fixtures";
const admin = "http://127.0.0.1:3000";

test("operator signs in through an HttpOnly cookie, reads real counts and signs out", async ({
  page,
  context,
  request,
}) => {
  const operator = await operatorAccount(request);
  await page.goto(admin);
  await page.getByLabel("Email", { exact: true }).fill(operator.email);
  await page.getByLabel("Password", { exact: true }).fill(operator.password);
  const signedIn = page.waitForResponse(
    (response) =>
      response.url() === `${admin}/api/session` &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const response = await signedIn;
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.user.role).toBe("admin");
  expect(data.access_token).toBeUndefined();
  expect(data.refresh_token).toBeUndefined();
  await expect(
    page.getByRole("heading", { name: "Operator console", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Verified businesses", { exact: true }),
  ).toBeVisible();
  const cookies = await context.cookies(admin);
  const session = cookies.find((cookie) => cookie.name === "msv_admin");
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Strict");
  expect(session?.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(await page.evaluate(() => document.cookie)).not.toContain("msv_admin");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Operator sign in", exact: true }),
  ).toBeVisible();
  expect((await context.request.get(`${admin}/api/session`)).status()).toBe(
    401,
  );
});

test("a customer cannot enter the operator console", async ({
  page,
  context,
  request,
}) => {
  const customer = await account(request, "customer");
  await page.goto(admin);
  await page.getByLabel("Email", { exact: true }).fill(customer.email);
  await page.getByLabel("Password", { exact: true }).fill(customer.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "active operator account",
  );
  expect(
    (await context.cookies(admin)).some(
      (cookie) => cookie.name === "msv_admin",
    ),
  ).toBe(false);
});

test("a foreign Origin cannot suspend a business through a staff cookie", async ({
  page,
  context,
  request,
}) => {
  const vendor = await availableVendor(request),
    operator = await operatorAccount(request);
  await page.goto(admin);
  await page.getByLabel("Email", { exact: true }).fill(operator.email);
  await page.getByLabel("Password", { exact: true }).fill(operator.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Operator console", exact: true }),
  ).toBeVisible();
  const rejected = await context.request.post(
    `${admin}/api/backend/admin/vendors/${vendor.id}/suspension`,
    {
      headers: { Origin: "https://foreign.example.com" },
      data: { reason: "Synthetic forbidden cross-site change" },
    },
  );
  expect(rejected.status()).toBe(403);
  const profile = await request.get(`${API}/api/v1/vendors/me`, {
    headers: vendor.headers,
  });
  expect((await profile.json()).verification_status).toBe("VERIFIED");
});

test("remote staff suspension removes the operator interface on refresh", async ({
  page,
  request,
}) => {
  const operator = await operatorAccount(request),
    other = await operatorAccount(request);
  await page.goto(admin);
  await page.getByLabel("Email", { exact: true }).fill(operator.email);
  await page.getByLabel("Password", { exact: true }).fill(operator.password);
  const signedIn = page.waitForResponse(
    (response) =>
      response.url() === `${admin}/api/session` &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const user = (await (await signedIn).json()).user;
  await expect(
    page.getByRole("heading", { name: "Operator console", exact: true }),
  ).toBeVisible();
  // Establish a completed initial read before revocation; otherwise that read
  // can correctly sign the operator out before the refresh click is possible.
  await expect(
    page.getByText("Verified businesses", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Refresh summary", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Refresh reviews", exact: true }),
  ).toBeEnabled();
  const suspended = await request.post(
    `${API}/api/v1/admin/users/${user.id}/suspension`,
    {
      headers: other.headers,
      data: {
        suspended: true,
        reason: "Synthetic independent operator suspension",
      },
    },
  );
  expect(suspended.ok()).toBeTruthy();
  await page
    .getByRole("button", { name: "Refresh summary", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Operator sign in", exact: true }),
  ).toBeVisible();
});
