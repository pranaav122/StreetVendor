import { randomUUID } from "node:crypto";
import { expect, test } from "./test";
import { API } from "./fixtures";

test("customer can register in Tamil and read a narrow-screen interface", async ({
  page,
  request,
}) => {
  const email = `ui-tamil-${randomUUID()}@example.com`,
    password = `Synthetic-${randomUUID()}`;
  try {
    await page.goto("/");
    await page.getByRole("button", { name: "தமிழ்", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "உங்கள் உள்ளூர் சந்தை", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "கணக்கை உருவாக்கவும்", exact: true })
      .click();
    await page.getByLabel("பெயர்", { exact: true }).fill("சோதனை வாடிக்கையாளர்");
    await page.getByLabel("மின்னஞ்சல்", { exact: true }).fill(email);
    await page.getByLabel("கடவுச்சொல்", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "கணக்கை உருவாக்கவும்", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "சந்திப்பு இடத்திற்கு அருகில்",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "கணக்கு", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.screenshot({
      path: ".superpowers/sdd/2026-11-02-applications/customer-tamil-live.png",
    });
    // Stress translated text independently of the physical-device font-scale check.
    await page.evaluate(() => {
      const labels = [
        ...document.querySelectorAll<HTMLElement>('[dir="auto"]'),
      ].map((node) => ({
        node,
        size: parseFloat(getComputedStyle(node).fontSize),
        line: parseFloat(getComputedStyle(node).lineHeight),
      }));
      for (const { node, size, line } of labels) {
        node.style.fontSize = `${size * 2}px`;
        if (Number.isFinite(line)) node.style.lineHeight = `${line * 2}px`;
      }
    });
    const navigation = page.getByRole("navigation");
    await expect(navigation).toBeVisible();
    expect(
      await navigation.getByRole("link").evaluateAll((links) =>
        links.flatMap((link) => {
          const label = link.querySelector('[dir="auto"]');
          if (!label) return ["Missing label"];
          const bounds = link.getBoundingClientRect(),
            text = label.getBoundingClientRect();
          return text.left < bounds.left - 1 || text.right > bounds.right + 1
            ? [link.textContent]
            : [];
        }),
      ),
    ).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.screenshot({
      path: ".superpowers/sdd/2026-11-05-simple-mobile-ui/customer-tamil-large-live.png",
      fullPage: true,
    });
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
