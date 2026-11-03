import assert from "node:assert/strict";
import { test } from "node:test";
import { createSessionStore } from "../src/storage.ts";

const tokens = {
  access_token: "access",
  refresh_token: "refresh",
  token_type: "bearer" as const,
  expires_in: 600,
};

test("browser preview credentials disappear when the application is recreated", async () => {
  const first = createSessionStore(null, "customer");
  await first.write(tokens);
  assert.deepEqual(await first.read(), tokens);
  assert.equal(await createSessionStore(null, "customer").read(), null);
});

test("corrupt native credentials are removed rather than used as a session", async () => {
  let saved: string | null = '{"bad":"session"}';
  const store = createSessionStore(
    {
      getItem: async () => saved,
      setItem: async (_key, value) => {
        saved = value;
      },
      removeItem: async () => {
        saved = null;
      },
    },
    "customer",
  );
  assert.equal(await store.read(), null);
  assert.equal(saved, null);
  await store.write(tokens);
  assert.deepEqual(await store.read(), tokens);
  await store.clear();
  assert.equal(saved, null);
});
