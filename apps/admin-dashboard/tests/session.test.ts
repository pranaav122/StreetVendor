import assert from "node:assert/strict";
import test from "node:test";
import { AdminServer } from "../src/server/core.ts";

const origin = "https://staff.example.com";
const operator = {
  id: "e4385418-cbe6-493f-86b7-872c7bd65666",
  email: "operator@example.com",
  role: "admin",
  status: "ACTIVE",
  display_name: "Synthetic operator",
  preferred_language: "en",
  created_at: "2026-11-03T00:00:00Z",
  email_verified_at: null,
};
function setup(role = "admin", maximum = 256) {
  const calls: string[] = [];
  let clock = Date.now();
  let liveRole = role;
  const server = new AdminServer({
    apiOrigin: "https://api.example.com",
    publicOrigin: origin,
    production: true,
    maxSessions: maximum,
    now: () => clock,
    fetch: async (url, options) => {
      const path = new URL(String(url)).pathname;
      const headers = new Headers(options?.headers);
      assert.equal(headers.get("Cookie"), null);
      if (path !== "/api/v1/auth/login")
        assert.equal(headers.get("Authorization"), "Bearer private-api-access");
      calls.push(`${options?.method ?? "GET"} ${path}`);
      if (path === "/api/v1/auth/login")
        return Response.json({
          access_token: "private-api-access",
          refresh_token: "private-api-refresh",
          token_type: "bearer",
          expires_in: 600,
        });
      if (path === "/api/v1/users/me")
        return Response.json({ ...operator, role: liveRole });
      if (path === "/api/v1/auth/logout")
        return new Response(null, { status: 204 });
      if (path === "/api/v1/admin/summary")
        return Response.json({ open_reports: 2 });
      return Response.json({ ok: true });
    },
  });
  return {
    server,
    calls,
    expire: () => {
      clock += 8 * 3600000 + 1;
    },
    role: (value: string) => {
      liveRole = value;
    },
  };
}
function login(server: AdminServer, suppliedOrigin = origin) {
  return server.session(
    new Request(`${origin}/api/session`, {
      method: "POST",
      headers: { Origin: suppliedOrigin, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "operator@example.com",
        password: "Synthetic-password-with-length",
      }),
    }),
  );
}
const cookie = (response: Response) =>
  response.headers.get("Set-Cookie")!.split(";")[0]!;

test("staff cookie is opaque, HttpOnly, Secure and strict; API tokens never reach the browser", async () => {
  const { server } = setup();
  const response = await login(server);
  assert.equal(response.status, 200);
  const header = response.headers.get("Set-Cookie")!;
  assert.match(header, /^__Host-msv_admin=[A-Za-z0-9_-]{43};/);
  for (const flag of ["HttpOnly", "Secure", "SameSite=Strict", "Path=/"])
    assert.ok(header.includes(flag));
  assert.ok(!header.includes("private-api"));
  assert.ok(!(await response.text()).includes("private-api"));
  const current = await server.session(
    new Request(`${origin}/api/session`, {
      headers: { Cookie: cookie(response) },
    }),
  );
  assert.equal(current.status, 200);
  assert.equal((await current.json()).user.role, "admin");
  assert.equal(current.headers.get("Cache-Control"), "no-store");
});
test("non-admin login is rejected and its newly issued backend family is logged out", async () => {
  const { server, calls } = setup("customer");
  const response = await login(server);
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("Set-Cookie"), null);
  assert.ok(calls.includes("POST /api/v1/auth/logout"));
});
test("foreign or missing Origin cannot log in or mutate through staff cookies", async () => {
  const { server, calls } = setup();
  assert.equal((await login(server, "https://other.example.com")).status, 403);
  assert.equal(calls.length, 0);
  const signed = await login(server);
  const count = calls.length;
  const response = await server.backend(
    new Request(
      `${origin}/api/backend/admin/vendors/e4385418-cbe6-493f-86b7-872c7bd65666/suspension`,
      {
        method: "POST",
        headers: { Cookie: cookie(signed), "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Synthetic staff reason" }),
      },
    ),
    ["admin", "vendors", operator.id, "suspension"],
  );
  assert.equal(response.status, 403);
  assert.equal(calls.length, count);
});
test("the proxy rejects auth/token paths and unknown query parameters before forwarding", async () => {
  const { server, calls } = setup();
  const signed = await login(server);
  const count = calls.length;
  const headers = { Cookie: cookie(signed) };
  assert.equal(
    (
      await server.backend(
        new Request(`${origin}/api/backend/auth/refresh`, { headers }),
        ["auth", "refresh"],
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await server.backend(
        new Request(
          `${origin}/api/backend/admin/summary?url=https://other.example.com`,
          { headers },
        ),
        ["admin", "summary"],
      )
    ).status,
    400,
  );
  assert.equal(calls.length, count);
});
test("live role changes invalidate the staff cookie before a protected request", async () => {
  const { server, role } = setup();
  const signed = await login(server);
  role("customer");
  const response = await server.backend(
    new Request(`${origin}/api/backend/admin/summary`, {
      headers: { Cookie: cookie(signed) },
    }),
    ["admin", "summary"],
  );
  assert.equal(response.status, 403);
  const next = await server.session(
    new Request(`${origin}/api/session`, {
      headers: { Cookie: cookie(signed) },
    }),
  );
  assert.equal(next.status, 401);
});
test("absolute expiry and explicit logout remove server-side credentials", async () => {
  const { server, expire, calls } = setup();
  const signed = await login(server);
  const headers = { Cookie: cookie(signed), Origin: origin };
  assert.equal(
    (
      await server.session(
        new Request(`${origin}/api/session`, { method: "DELETE", headers }),
      )
    ).status,
    204,
  );
  assert.ok(calls.includes("POST /api/v1/auth/logout"));
  assert.equal(
    (await server.session(new Request(`${origin}/api/session`, { headers })))
      .status,
    401,
  );
  const second = await login(server);
  expire();
  assert.equal(
    (
      await server.session(
        new Request(`${origin}/api/session`, {
          headers: { Cookie: cookie(second) },
        }),
      )
    ).status,
    401,
  );
});
test("the bounded registry rejects a new login while keeping an existing staff session", async () => {
  const { server } = setup("admin", 1);
  const first = await login(server);
  assert.equal((await login(server)).status, 503);
  assert.equal(
    (
      await server.session(
        new Request(`${origin}/api/session`, {
          headers: { Cookie: cookie(first) },
        }),
      )
    ).status,
    200,
  );
});
test("oversized login JSON is rejected before contacting the backend", async () => {
  const { server, calls } = setup();
  const response = await server.session(
    new Request(`${origin}/api/session`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "operator@example.com",
        password: "a".repeat(20000),
      }),
    }),
  );
  assert.equal(response.status, 413);
  assert.equal(calls.length, 0);
});
test("allowed proxy requests use server credentials and ignore caller authorization", async () => {
  const { server, calls } = setup();
  const signed = await login(server);
  const headers = {
    Cookie: cookie(signed),
    Authorization: "Bearer caller-controlled",
    Origin: origin,
    "Content-Type": "application/json",
  };
  const response = await server.backend(
    new Request(`${origin}/api/backend/admin/summary`, { headers }),
    ["admin", "summary"],
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { open_reports: 2 });
  const changed = await server.backend(
    new Request(
      `${origin}/api/backend/admin/vendors/${operator.id}/verification`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          decision: "VERIFIED",
          reason: "Synthetic staff approval",
        }),
      },
    ),
    ["admin", "vendors", operator.id, "verification"],
  );
  assert.equal(changed.status, 200);
  assert.ok(
    calls.includes(`POST /api/v1/admin/vendors/${operator.id}/verification`),
  );
});
test("chunked login input has the same size bound without Content-Length", async () => {
  const { server, calls } = setup();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode(
          JSON.stringify({ password: "a".repeat(20000) }),
        ),
      );
      controller.close();
    },
  });
  const response = await server.session(
    new Request(`${origin}/api/session`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body,
      duplex: "half",
    } as RequestInit),
  );
  assert.equal(response.status, 413);
  assert.equal(calls.length, 0);
});
test("production requires public HTTPS and plaintext API transport is limited to explicit private hosts", () => {
  assert.throws(
    () =>
      new AdminServer({
        apiOrigin: "https://api.example.com",
        publicOrigin: "http://staff.example.com",
        production: true,
      }),
    /HTTPS/,
  );
  assert.throws(
    () =>
      new AdminServer({
        apiOrigin: "http://untrusted.example.com",
        publicOrigin: origin,
        production: true,
        internalApiHttp: true,
      }),
    /private/,
  );
  assert.throws(
    () =>
      new AdminServer({
        apiOrigin: "http://127.0.0.1:8000",
        publicOrigin: origin,
        production: true,
      }),
    /private/,
  );
  assert.doesNotThrow(
    () =>
      new AdminServer({
        apiOrigin: "http://api:8000",
        publicOrigin: origin,
        production: true,
        internalApiHttp: true,
      }),
  );
});
