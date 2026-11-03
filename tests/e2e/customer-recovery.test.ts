import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "./test";
import { API, account } from "./fixtures";

async function mailLink(
  request: APIRequestContext,
  email: string,
  kind: "reset-password" | "verify-email",
) {
  let identifier: string | undefined;
  await expect
    .poll(
      async () => {
        const inbox = await request.get(
          "http://127.0.0.1:8025/api/v1/messages",
        );
        const data = await inbox.json();
        identifier = data.messages.find(
          (message: { To: { Address: string }[] }) =>
            message.To.some((recipient) => recipient.Address === email),
        )?.ID;
        return Boolean(identifier);
      },
      { timeout: 10000 },
    )
    .toBe(true);
  const response = await request.get(
    `http://127.0.0.1:8025/api/v1/message/${identifier}`,
  );
  const message = await response.json();
  const match = message.Text.match(
    new RegExp(`http://127\\.0\\.0\\.1:8081/${kind}#token=[A-Za-z0-9_-]+`),
  );
  if (!match)
    throw new Error(
      "The synthetic mail did not contain the expected local link.",
    );
  return match[0] as string;
}

test("customer resets a password using an actual local SMTP message", async ({
  page,
  request,
}) => {
  const customer = await account(request, "customer"),
    password = `Changed-${randomUUID()}`;
  await page.goto("/");
  await page
    .getByRole("button", { name: "Forgot password?", exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill(customer.email);
  await page
    .getByRole("button", { name: "Send reset link", exact: true })
    .click();
  await expect(
    page.getByText("If your account is eligible, a reset link will be sent.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.goto(await mailLink(request, customer.email, "reset-password"));
  await expect(
    page.getByRole("heading", { name: "Choose a new password", exact: true }),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/#token=/);
  await page.getByLabel("New password", { exact: true }).fill(password);
  await page.getByLabel("Repeat new password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Save new password", exact: true })
    .click();
  await expect(
    page.getByText("Password changed. Sign in with your new password.", {
      exact: true,
    }),
  ).toBeVisible();
  const oldSession = await request.get(`${API}/api/v1/users/me`, {
    headers: customer.headers,
  });
  expect(oldSession.status()).toBe(401);
  const next = await request.post(`${API}/api/v1/auth/login`, {
    data: { email: customer.email, password },
  });
  expect(next.ok()).toBeTruthy();
});

test("customer confirms an email using its fragment-only link", async ({
  page,
  request,
}) => {
  const customer = await account(request, "customer");
  const sent = await request.post(`${API}/api/v1/auth/email/verification`, {
    headers: customer.headers,
  });
  expect(sent.status()).toBe(202);
  await page.goto(await mailLink(request, customer.email, "verify-email"));
  await expect(
    page.getByRole("heading", { name: "Confirm your email", exact: true }),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/#token=/);
  await page
    .getByRole("button", { name: "Confirm email", exact: true })
    .click();
  await expect(
    page.getByText("Email link confirmed. You can return to your account.", {
      exact: true,
    }),
  ).toBeVisible();
  const profile = await request.get(`${API}/api/v1/users/me`, {
    headers: customer.headers,
  });
  expect((await profile.json()).email_verified_at).not.toBeNull();
});
