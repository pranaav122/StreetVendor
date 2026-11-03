import { expect, test } from "./test";
import { API, availableVendor } from "./fixtures";
test("the offline control is available even when the first business read fails", async ({
  page,
  request,
}) => {
  const vendor = await availableVendor(request);
  await page.route(`${API}/api/v1/vendors/me`, (route) =>
    route.request().method() === "GET"
      ? route.abort("failed")
      : route.continue(),
  );
  await page.goto("http://127.0.0.1:8082");
  await page.getByLabel("Email", { exact: true }).fill(vendor.email);
  await page.getByLabel("Password", { exact: true }).fill(vendor.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Go offline", exact: true }).click();
  await expect(
    page.getByText("You are offline. Your location is not being shared.", {
      exact: true,
    }),
  ).toBeVisible();
  const stored = await request.get(`${API}/api/v1/vendors/me`, {
    headers: vendor.headers,
  });
  expect((await stored.json()).is_available).toBe(false);
});
test("a failed business refresh keeps the offline control and committed offline state", async ({
  page,
  context,
  request,
}) => {
  const vendor = await availableVendor(request);
  await context.grantPermissions(["geolocation"], {
    origin: "http://127.0.0.1:8082",
  });
  await context.setGeolocation({
    latitude: 13.0827,
    longitude: 80.2707,
    accuracy: 10,
  });
  await page.goto("http://127.0.0.1:8082");
  await page.getByLabel("Email", { exact: true }).fill(vendor.email);
  await page.getByLabel("Password", { exact: true }).fill(vendor.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("button", { name: "Go online and share location", exact: true })
    .click();
  await expect(
    page.getByText("Location sharing is active on this device.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.route(`${API}/api/v1/vendors/me`, (route) =>
    route.request().method() === "GET"
      ? route.abort("failed")
      : route.continue(),
  );
  await page
    .getByRole("button", { name: "Refresh business", exact: true })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: /Failed to fetch|Business status could not refresh/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Go offline", exact: true }).click();
  await expect(
    page.getByText("You are offline. Your location is not being shared.", {
      exact: true,
    }),
  ).toBeVisible();
  const stored = await request.get(`${API}/api/v1/vendors/me`, {
    headers: vendor.headers,
  });
  expect((await stored.json()).is_available).toBe(false);
});
test("approved partner explicitly shares a location and removes it when going offline", async ({
  page,
  context,
  request,
}) => {
  const vendor = await availableVendor(request);
  await request.patch(`${API}/api/v1/vendors/me/availability`, {
    headers: vendor.headers,
    data: { is_available: false, location_sharing_enabled: false },
  });
  await context.grantPermissions(["geolocation"], {
    origin: "http://127.0.0.1:8082",
  });
  await context.setGeolocation({
    latitude: 13.0827,
    longitude: 80.2707,
    accuracy: 10,
  });
  await page.goto("http://127.0.0.1:8082");
  await page.getByLabel("Email", { exact: true }).fill(vendor.email);
  await page.getByLabel("Password", { exact: true }).fill(vendor.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("button", { name: "Allow background location", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "native development build" }),
  ).toContainText("native development build");
  await page
    .getByRole("button", { name: "Go online and share location", exact: true })
    .click();
  await expect(
    page.getByText("Location sharing is active on this device.", {
      exact: true,
    }),
  ).toBeVisible();
  const online = await request.get(`${API}/api/v1/vendors/me`, {
    headers: vendor.headers,
  });
  expect((await online.json()).is_available).toBe(true);
  await page.getByRole("button", { name: "Go offline", exact: true }).click();
  await expect(
    page.getByText("You are offline. Your location is not being shared.", {
      exact: true,
    }),
  ).toBeVisible();
  const offline = await request.get(`${API}/api/v1/vendors/me`, {
    headers: vendor.headers,
  });
  expect((await offline.json()).is_available).toBe(false);
});
