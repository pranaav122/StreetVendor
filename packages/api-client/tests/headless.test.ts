import assert from "node:assert/strict";
import test from "node:test";
import { ApiClient, ApiError } from "../src/index.ts";

test("a headless client returns 401 without rotating or altering shared credentials", async () => {
  const tokens = {
    access_token: "expired-access",
    refresh_token: "current-refresh",
    token_type: "bearer" as const,
    expires_in: 600,
  };
  let calls = 0;
  const client = new ApiClient({
    baseUrl: "https://api.example.com",
    refreshOnUnauthorized: false,
    store: {
      read: async () => tokens,
      write: async () => {
        throw new Error("Headless task must not write credentials");
      },
      clear: async () => {
        throw new Error("Headless task must not clear credentials");
      },
    },
    fetch: async () => {
      calls++;
      return new Response(
        JSON.stringify({
          error: { code: "EXPIRED", message: "Sign in again." },
        }),
        { status: 401 },
      );
    },
  });
  await assert.rejects(
    client.request("/vendors/me/location", { method: "PUT", body: {} }),
    (error: unknown) =>
      error instanceof ApiError &&
      error.status === 401 &&
      error.code === "EXPIRED",
  );
  assert.equal(calls, 1);
  assert.deepEqual(await client.session(), tokens);
});
