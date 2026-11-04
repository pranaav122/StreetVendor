import assert from "node:assert/strict";
import test from "node:test";
import { SharingController, type Fix } from "../src/location/controller.ts";
import { revalidateSharing } from "../src/location/resume.ts";
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function setup(first?: () => Promise<Fix>) {
  const calls: string[] = [];
  const controller = new SharingController({
    now: Date.now,
    first:
      first ??
      (async () => ({
        latitude: 13.08,
        longitude: 80.27,
        accuracy_m: 10,
        captured_at: new Date().toISOString(),
      })),
    watch: async () => () => {
      calls.push("stop");
    },
    online: async () => {},
    upload: async () => {},
    offline: async () => {
      calls.push("offline");
    },
    changed: () => {},
  });
  await controller.online();
  const options = {
    controller,
    requiresBackground: true,
    permissions: async () => ({ foreground: true, background: true }),
    business: async () => ({ is_available: true }),
    disableBackground: () => {
      calls.push("disable-background");
    },
  };
  return { controller, calls, options };
}

test("resume is visibly unavailable before a delayed permission check resolves", async () => {
  const { controller, calls, options } = await setup();
  const permission = deferred<{ foreground: boolean; background: boolean }>();
  const checking = revalidateSharing({
    ...options,
    permissions: () => permission.promise,
  });
  assert.equal(controller.state.status, "PAUSED");
  assert.equal(controller.state.capturedAt, null);
  assert.deepEqual(calls, ["stop"]);
  controller.confirmExternalFix(new Date().toISOString());
  assert.equal(controller.state.status, "PAUSED");
  permission.resolve({ foreground: false, background: false });
  await checking;
  assert.equal(controller.state.status, "OFFLINE");
});

test("resume stays unavailable during a delayed business check, then obtains a fresh fix", async () => {
  const { controller, calls, options } = await setup();
  const business = deferred<{ is_available: boolean }>();
  const checking = revalidateSharing({
    ...options,
    business: () => business.promise,
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(controller.state.status, "PAUSED");
  assert.deepEqual(calls, ["stop"]);
  business.resolve({ is_available: true });
  await checking;
  assert.equal(controller.state.status, "ONLINE");
  assert.ok(controller.state.capturedAt);
});

test("resume never starts a deliberately offline or stopping session", async () => {
  const { controller, calls, options } = await setup();
  const stopping = controller.offline();
  await revalidateSharing(options);
  await stopping;
  assert.equal(controller.state.status, "OFFLINE");
  await revalidateSharing(options);
  assert.equal(controller.state.status, "OFFLINE");
  assert.deepEqual(calls, ["stop", "offline"]);
});

test("validated resume waits for a canceled start before starting a new fresh feed", async () => {
  const first = deferred<{
    latitude: number;
    longitude: number;
    accuracy_m: number;
    captured_at: string;
  }>();
  const fix = () => ({
    latitude: 13.08,
    longitude: 80.27,
    accuracy_m: 10,
    captured_at: new Date().toISOString(),
  });
  let reads = 0;
  const controller = new SharingController({
    now: Date.now,
    first: async () => (++reads === 1 ? first.promise : fix()),
    watch: async () => () => {},
    online: async () => {},
    upload: async () => {},
    offline: async () => {},
    changed: () => {},
  });
  const starting = controller.online();
  const checking = revalidateSharing({
    controller,
    requiresBackground: false,
    permissions: async () => ({ foreground: true, background: false }),
    business: async () => ({ is_available: true }),
    disableBackground: () => {},
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(controller.state.status, "PAUSED");
  first.resolve(fix());
  await Promise.all([starting, checking]);
  assert.equal(reads, 2);
  assert.equal(controller.state.status, "ONLINE");
});

test("a failed fresh fix after resume validation confirms server offline", async () => {
  let reads = 0;
  const { controller, calls, options } = await setup(async () => {
    if (++reads > 1) throw new Error("Fresh GPS unavailable");
    return {
      latitude: 13.08,
      longitude: 80.27,
      accuracy_m: 10,
      captured_at: new Date().toISOString(),
    };
  });
  await revalidateSharing(options);
  assert.equal(controller.state.status, "OFFLINE");
  assert.deepEqual(calls, ["stop", "offline"]);
});
test("revoked foreground or background permission stops the sensor and confirms server offline", async () => {
  for (const permission of [
    { foreground: false, background: true },
    { foreground: true, background: false },
  ]) {
    const { controller, calls, options } = await setup();
    await revalidateSharing({
      ...options,
      permissions: async () => permission,
    });
    assert.deepEqual(calls, ["stop", "disable-background", "offline"]);
    assert.equal(controller.state.status, "OFFLINE");
  }
});
test("permission-query failure fails closed and requests server erasure", async () => {
  const { controller, calls, options } = await setup();
  await revalidateSharing({
    ...options,
    permissions: async () => {
      throw new Error("OS unavailable");
    },
  });
  assert.deepEqual(calls, ["stop", "disable-background", "offline"]);
  assert.equal(controller.state.status, "OFFLINE");
});
test("server offline state stops a still-running local sensor", async () => {
  const { controller, calls, options } = await setup();
  await revalidateSharing({
    ...options,
    business: async () => ({ is_available: false }),
  });
  assert.deepEqual(calls, ["stop", "offline"]);
  assert.equal(controller.state.status, "OFFLINE");
});
test("delayed resume checks cannot stop a newer explicit online session", async () => {
  const { controller, calls, options } = await setup();
  let release!: (value: { foreground: boolean; background: boolean }) => void;
  const permission = new Promise<{ foreground: boolean; background: boolean }>(
    (resolve) => {
      release = resolve;
    },
  );
  const checking = revalidateSharing({
    ...options,
    permissions: () => permission,
  });
  await controller.offline();
  await controller.online();
  const before = calls.length;
  release({ foreground: false, background: false });
  await checking;
  assert.equal(controller.state.status, "ONLINE");
  assert.equal(calls.length, before);
});
test("foreground-only sharing does not require background permission", async () => {
  const { controller, calls, options } = await setup();
  await revalidateSharing({
    ...options,
    requiresBackground: false,
    permissions: async () => ({ foreground: true, background: false }),
  });
  assert.equal(controller.state.status, "ONLINE");
  assert.deepEqual(calls, ["stop"]);
});
