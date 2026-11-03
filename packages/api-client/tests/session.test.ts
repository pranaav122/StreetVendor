import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiClient, type SessionStore } from "../src/index.ts";

const tokens = (suffix: string) => ({
  access_token: `access-${suffix}`,
  refresh_token: `refresh-${suffix}`,
  token_type: "bearer" as const,
  expires_in: 600,
});
function setup(handler: typeof fetch) {
  let saved: ReturnType<typeof tokens> | null = tokens("old");
  let cleared = 0;
  const store: SessionStore = {
    read: async () => saved,
    write: async (value) => {
      saved = value;
    },
    clear: async () => {
      saved = null;
    },
  };
  const client = new ApiClient({
    baseUrl: "https://api.example.com",
    store,
    fetch: handler,
    onSignedOut: () => {
      cleared += 1;
    },
  });
  return { client, saved: () => saved, cleared: () => cleared };
}
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

test("concurrent unauthorized requests rotate once and retry with the new token", async () => {
  let refreshes = 0;
  const { client } = setup(async (url, init) => {
    if (String(url).endsWith("/auth/refresh")) {
      refreshes++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return json(tokens("new"));
    }
    return new Headers(init?.headers).get("Authorization") ===
      "Bearer access-new"
      ? json({ id: "own-account" })
      : json({}, 401);
  });
  assert.deepEqual(
    await Promise.all([
      client.request("/users/me"),
      client.request("/users/me"),
    ]),
    [{ id: "own-account" }, { id: "own-account" }],
  );
  assert.equal(refreshes, 1);
});

test("rejected refresh clears credentials and private state exactly once", async () => {
  const state = setup(async () => json({}, 401));
  await assert.rejects(state.client.request("/users/me"));
  assert.equal(state.saved(), null);
  assert.equal(state.cleared(), 1);
});

test("sign out during refresh cannot restore the old account", async () => {
  let release!: () => void;
  let entered!: () => void;
  const ready = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const state = setup(async (url) => {
    if (String(url).endsWith("/auth/refresh")) {
      entered();
      await waiting;
      return json(tokens("late"));
    }
    return json({}, 401);
  });
  const request = state.client.request("/users/me");
  await ready;
  await state.client.clearSession();
  release();
  await assert.rejects(request);
  assert.equal(state.saved(), null);
});

test("retry is bounded when a newly issued access token is rejected", async () => {
  let calls = 0;
  const state = setup(async (url) => {
    calls++;
    return String(url).endsWith("/auth/refresh")
      ? json(tokens("new"))
      : json({}, 401);
  });
  await assert.rejects(state.client.request("/users/me"));
  assert.equal(calls, 3);
  assert.equal(state.saved(), null);
});

test("caller cancellation is forwarded and never retried", async () => {
  let calls = 0;
  const state = setup(async (_url, init) => {
    calls++;
    init?.signal?.throwIfAborted();
    return json({});
  });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    state.client.request("/users/me", { signal: controller.signal }),
  );
  assert.ok(calls <= 1);
});

test("absolute URLs cannot receive account credentials", async () => {
  let calls = 0;
  const { client } = setup(async () => {
    calls++;
    return json({});
  });
  await assert.rejects(client.request("https://another.example/steal"));
  assert.equal(calls, 0);
});

test("temporary refresh failure preserves credentials for an explicit retry", async () => {
  const state = setup(async (url) =>
    json({}, String(url).endsWith("/auth/refresh") ? 503 : 401),
  );
  await assert.rejects(state.client.request("/users/me"));
  assert.ok(state.saved());
  assert.equal(state.cleared(), 0);
});

test("late unauthorized response uses the already rotated access token", async () => {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  let refreshes = 0;
  const { client } = setup(async (url, init) => {
    if (String(url).endsWith("/auth/refresh")) {
      refreshes++;
      return json(tokens("new"));
    }
    if (new Headers(init?.headers).get("Authorization") === "Bearer access-new")
      return json({ ok: true });
    if (String(url).includes("slow")) await waiting;
    return json({}, 401);
  });
  const slow = client.request("/users/slow");
  await client.request("/users/me");
  release();
  await slow;
  assert.equal(refreshes, 1);
});

test("failed storage write from an old sign-in cannot clear a newer account", async () => {
  let rejectWrite!: (reason: Error) => void;
  let first = true;
  let saved: ReturnType<typeof tokens> | null = null;
  const store: SessionStore = {
    read: async () => saved,
    clear: async () => {
      saved = null;
    },
    write: async (value) => {
      if (first) {
        first = false;
        await new Promise<void>((_resolve, reject) => {
          rejectWrite = reject;
        });
      }
      saved = value;
    },
  };
  const client = new ApiClient({ baseUrl: "https://api.example.com", store });
  const old = client.setSession(tokens("old"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  const newer = client.setSession(tokens("new"));
  rejectWrite(new Error("Storage write failed"));
  await assert.rejects(old);
  await newer;
  assert.equal(
    (saved as ReturnType<typeof tokens> | null)?.access_token,
    "access-new",
  );
});
