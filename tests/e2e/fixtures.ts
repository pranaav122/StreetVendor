import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { expect, type APIRequestContext } from "@playwright/test";

export const API = process.env.TEST_API_URL ?? "http://127.0.0.1:8000";
export const fix = () => ({
  latitude: 13.0827,
  longitude: 80.2707,
  accuracy_m: 10,
  captured_at: new Date().toISOString(),
});

export async function account(
  request: APIRequestContext,
  role: "customer" | "vendor",
) {
  const email = `ui-${role}-${randomUUID()}@example.com`,
    password = `Synthetic-${randomUUID()}`;
  const registered = await request.post(`${API}/api/v1/auth/register/${role}`, {
    data: { email, password, display_name: `Synthetic ${role}` },
  });
  expect(registered.status()).toBe(201);
  const login = await request.post(`${API}/api/v1/auth/login`, {
    data: { email, password },
  });
  expect(login.ok()).toBeTruthy();
  const tokens = await login.json();
  return {
    email,
    password,
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  };
}

export async function availableVendor(request: APIRequestContext) {
  if (!process.env.BROWSER_FIXTURE_DB || !process.env.BROWSER_PYTHON)
    throw new Error("Use scripts/Test-Applications.ps1 for this workflow.");
  // This helper refuses every database except the generated disposable UI database.
  // Capture its synthetic credentials in memory and never write them to a test report.
  const operator = JSON.parse(
    execFileSync(
      process.env.BROWSER_PYTHON,
      [resolve("backend/scripts/browser_fixture.py")],
      { encoding: "utf8" },
    ),
  );
  const staffLogin = await request.post(`${API}/api/v1/auth/login`, {
    data: operator,
  });
  expect(staffLogin.ok()).toBeTruthy();
  const staffTokens = await staffLogin.json();
  const staff = { Authorization: `Bearer ${staffTokens.access_token}` };
  const vendor = await account(request, "vendor");
  const categories = await request.get(`${API}/api/v1/categories`, {
    headers: vendor.headers,
  });
  const category = (await categories.json()).items[0];
  const name = `Synthetic produce ${randomUUID().slice(0, 8)}`;
  const saved = await request.put(`${API}/api/v1/vendors/me/profile`, {
    headers: vendor.headers,
    data: {
      display_name: name,
      description: "Synthetic local produce for browser checks.",
      category_ids: [category.id],
    },
  });
  expect(saved.ok()).toBeTruthy();
  const profile = await saved.json();
  const submitted = await request.post(
    `${API}/api/v1/vendors/me/verifications`,
    {
      headers: vendor.headers,
      data: {
        evidence_note: "Synthetic operator can check this test business.",
      },
    },
  );
  expect(submitted.status()).toBe(201);
  const approved = await request.post(
    `${API}/api/v1/admin/vendors/${profile.id}/verification`,
    {
      headers: staff,
      data: {
        decision: "VERIFIED",
        reason: "Synthetic staff review for browser workflow.",
      },
    },
  );
  expect(approved.ok()).toBeTruthy();
  const online = await request.patch(`${API}/api/v1/vendors/me/availability`, {
    headers: vendor.headers,
    data: {
      is_available: true,
      location_sharing_enabled: true,
      location: fix(),
    },
  });
  expect(online.ok()).toBeTruthy();
  return { ...vendor, id: profile.id, name, staff };
}
