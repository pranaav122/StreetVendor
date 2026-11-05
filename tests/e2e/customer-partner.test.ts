import { expect, test } from "./test";
import { API, account, availableVendor } from "./fixtures";

test("Customer and Partner arrange and complete a visit through both interfaces and browser GPS", async ({
  page: customerPage,
  context,
  request,
}) => {
  const vendor = await availableVendor(request),
    customer = await account(request, "customer");
  expect(
    (
      await request.patch(`${API}/api/v1/vendors/me/availability`, {
        headers: vendor.headers,
        data: { is_available: false, location_sharing_enabled: false },
      })
    ).ok(),
  ).toBeTruthy();
  await context.grantPermissions(["geolocation"], {
    origin: "http://127.0.0.1:8082",
  });
  await context.setGeolocation({
    latitude: 13.0847,
    longitude: 80.2707,
    accuracy: 10,
  });
  const partnerPage = await context.newPage();
  await partnerPage.goto("http://127.0.0.1:8082");
  await partnerPage.getByLabel("Email", { exact: true }).fill(vendor.email);
  await partnerPage
    .getByLabel("Password", { exact: true })
    .fill(vendor.password);
  await partnerPage
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await partnerPage
    .getByRole("button", { name: "Go online", exact: true })
    .click();
  await expect(
    partnerPage.getByText("Location sharing is active on this device.", {
      exact: true,
    }),
  ).toBeVisible();
  await partnerPage
    .getByRole("link", { name: "Customers", exact: true })
    .click();

  await customerPage.goto("/");
  await customerPage.getByLabel("Email", { exact: true }).fill(customer.email);
  await customerPage
    .getByLabel("Password", { exact: true })
    .fill(customer.password);
  await customerPage
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await customerPage
    .getByRole("button", { name: "Enter coordinates", exact: true })
    .click();
  await customerPage.getByLabel("Meeting latitude").fill("13.0827");
  await customerPage.getByLabel("Meeting longitude").fill("80.2707");
  await customerPage
    .getByLabel("Meeting label")
    .fill("Synthetic joint market entrance");
  await customerPage
    .getByRole("button", { name: "Set meeting point", exact: true })
    .click();
  await customerPage
    .getByRole("link", { name: `View ${vendor.name}`, exact: true })
    .click();
  await customerPage
    .getByRole("button", { name: "Request visit", exact: true })
    .click();
  await expect(
    customerPage.getByRole("heading", { name: "Visit pending", exact: true }),
  ).toBeVisible();
  await partnerPage
    .getByRole("link", { name: "View visit", exact: true })
    .click();
  await partnerPage
    .getByRole("button", { name: "Accept visit", exact: true })
    .click();
  await expect(
    customerPage.getByRole("heading", { name: "Visit accepted", exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await expect(
    customerPage.getByText("Vendor location is available.", { exact: true }),
  ).toBeVisible();
  await partnerPage
    .getByRole("button", { name: "I’m on my way", exact: true })
    .click();

  // The browser supplies real geolocation events; application code sends each fix
  // through authenticated HTTP. The backend's arrival clock is never bypassed.
  await new Promise((resolve) => setTimeout(resolve, 6000));
  const first = partnerPage.waitForResponse(
    (response) =>
      response.url() === `${API}/api/v1/vendors/me/location` &&
      response.request().method() === "PUT",
  );
  await context.setGeolocation({
    latitude: 13.0827,
    longitude: 80.2707,
    accuracy: 10,
  });
  expect((await first).ok()).toBeTruthy();
  await new Promise((resolve) => setTimeout(resolve, 6000));
  const second = partnerPage.waitForResponse(
    (response) =>
      response.url() === `${API}/api/v1/vendors/me/location` &&
      response.request().method() === "PUT",
  );
  await context.setGeolocation({
    latitude: 13.0827,
    longitude: 80.2707,
    accuracy: 10,
  });
  expect((await second).ok()).toBeTruthy();
  await expect(
    partnerPage.getByRole("button", { name: "Complete visit", exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await partnerPage
    .getByRole("button", { name: "Complete visit", exact: true })
    .click();
  await expect(
    customerPage.getByRole("heading", { name: "Visit completed", exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await expect(
    customerPage.getByText("Vendor location is available.", { exact: true }),
  ).toHaveCount(0);
  await partnerPage.getByRole("link", { name: "Home", exact: true }).click();
  await partnerPage
    .getByRole("button", { name: "Go offline", exact: true })
    .last()
    .click();
  await expect
    .poll(
      async () =>
        (
          await (
            await request.get(`${API}/api/v1/vendors/me`, {
              headers: vendor.headers,
            })
          ).json()
        ).is_available,
    )
    .toBe(false);
});
