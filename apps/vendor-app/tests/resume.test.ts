import assert from "node:assert/strict";
import test from "node:test";
import { SharingController } from "../src/location/controller.ts";
import { revalidateSharing } from "../src/location/resume.ts";
async function setup() {
  const calls: string[] = [];
  const controller = new SharingController({
    now: Date.now,
    first: async () => ({
      latitude: 13.08,
      longitude: 80.27,
      accuracy_m: 10,
      captured_at: new Date().toISOString(),
    }),
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
    assert.deepEqual(calls, ["disable-background", "stop", "offline"]);
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
  assert.deepEqual(calls, ["disable-background", "stop", "offline"]);
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
  assert.deepEqual(calls, []);
});
