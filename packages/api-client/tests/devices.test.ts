import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiClient } from "../src/index.ts";
import { registerInstallation, type PushDriver } from "../src/devices.ts";

const project = "11111111-1111-4111-8111-111111111111",
  installation = "22222222-2222-4222-8222-222222222222";
function driver(changes: Partial<PushDriver> = {}): PushDriver {
  return {
    platform: "android",
    physical: true,
    nativeBuild: true,
    projectId: project,
    permission: async () => true,
    token: async () => `ExpoPushToken[${"x".repeat(32)}]`,
    installation: async () => installation,
    ...changes,
  };
}
function client(handler: typeof fetch) {
  return new ApiClient({
    baseUrl: "https://api.example.com",
    store: {
      read: async () => ({
        access_token: "access",
        refresh_token: "refresh",
        token_type: "bearer",
        expires_in: 600,
      }),
      write: async () => {},
      clear: async () => {},
    },
    fetch: handler,
  });
}

test("missing native configuration never prompts for permission or contacts the API", async () => {
  const api = client(async () => {
    throw new Error("Unexpected API call");
  });
  const unavailable = driver({
    projectId: null,
    permission: async () => {
      throw new Error("Unexpected permission prompt");
    },
  });
  assert.equal(
    (await registerInstallation(api, unavailable, "customer", true)).state,
    "UNAVAILABLE",
  );
});

test("permission denial does not obtain or register a push address", async () => {
  const api = client(async () => {
    throw new Error("Unexpected API call");
  });
  const denied = driver({
    permission: async () => false,
    token: async () => {
      throw new Error("Unexpected address request");
    },
  });
  assert.equal(
    (await registerInstallation(api, denied, "customer", true)).state,
    "DENIED",
  );
});

test("registration binds the application and installation and reports disabled delivery honestly", async () => {
  let body: Record<string, unknown> | undefined;
  const api = client(async (url, init) => {
    assert.equal(
      String(url),
      `https://api.example.com/api/v1/devices/${installation}`,
    );
    assert.equal(init?.method, "PUT");
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      "Bearer access",
    );
    body = JSON.parse(String(init?.body));
    return new Response('{"delivery_enabled":false}', { status: 200 });
  });
  const result = await registerInstallation(api, driver(), "customer", false);
  assert.equal(body?.app_kind, "customer");
  assert.equal(body?.project_id, project);
  assert.equal(result.state, "DISABLED");
  assert.ok(!JSON.stringify(result).includes("ExpoPushToken"));
});
