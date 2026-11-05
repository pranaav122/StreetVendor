import { expect, test } from "./test";
import { account } from "./fixtures";

const applications = [
  {
    role: "customer",
    port: 8081,
    labels: ["Nearby", "Your visits", "Account"],
    settings: "Account",
  },
  {
    role: "vendor",
    port: 8082,
    labels: ["Home", "Customers", "My shop", "More"],
    settings: "More",
  },
] as const;

for (const application of applications) {
  test(`${application.role} navigation stays reachable after scrolling account controls`, async ({
    page,
    request,
  }) => {
    const user = await account(request, application.role);
    await page.goto(`http://127.0.0.1:${application.port}`);
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await page.getByLabel("Email", { exact: true }).fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    const navigation = page.getByRole("navigation", {
      name: "Main navigation",
    });
    for (const label of application.labels) {
      await expect(
        navigation.getByRole("link", { name: label, exact: true }),
      ).toBeVisible();
    }
    await navigation
      .getByRole("link", { name: application.settings, exact: true })
      .click();
    if (application.role === "vendor")
      await page
        .getByRole("button", { name: "Account deletion", exact: true })
        .click();
    await page
      .getByLabel("Type DELETE to delete your account", { exact: true })
      .scrollIntoViewIfNeeded();
    const active = navigation.getByRole("link", {
      name: application.settings,
      exact: true,
    });
    await expect(active).toHaveAttribute("aria-selected", "true");
    const bounds = await navigation.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(845);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
  });
}
