import assert from "node:assert/strict";
import test from "node:test";
import {
  SharingController,
  usableFix,
  type Fix,
} from "../src/location/controller.ts";
const now = Date.now();
const fix: Fix = {
  latitude: 13.0827,
  longitude: 80.2707,
  accuracy_m: 10,
  captured_at: new Date(now).toISOString(),
};
test("retrying degraded sharing replaces the old sensor instead of duplicating it", async () => {
  let clock = now;
  let send!: (fix: Fix) => void;
  const calls: string[] = [];
  const controller = new SharingController({
    now: () => clock,
    first: async () => ({ ...fix, captured_at: new Date(clock).toISOString() }),
    watch: async (next) => {
      send = next;
      calls.push("watch");
      return () => {
        calls.push("stop");
      };
    },
    online: async () => {},
    upload: async () => {
      throw new Error("Connection lost");
    },
    offline: async () => {},
    changed: () => {},
  });
  await controller.online();
  clock += 6000;
  send({ ...fix, captured_at: new Date(clock).toISOString() });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(controller.state.status, "DEGRADED");
  await controller.online();
  assert.deepEqual(calls, ["watch", "stop", "watch"]);
});
test("old confirmed coordinates are visibly degraded after the freshness window", async () => {
  let clock = now;
  const controller = new SharingController({
    now: () => clock,
    first: async () => fix,
    watch: async () => () => {},
    online: async () => {},
    upload: async () => {},
    offline: async () => {},
    changed: () => {},
  });
  await controller.online();
  clock += 90001;
  controller.checkFreshness();
  assert.equal(controller.state.status, "DEGRADED");
});
test("offline during an online write deletes the point after that write finishes", async () => {
  const calls: string[] = [];
  let release!: () => void;
  let entered!: () => void;
  const ready = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const controller = new SharingController({
    now: () => now,
    first: async () => fix,
    watch: async () => {
      calls.push("watch");
      return () => {};
    },
    online: async () => {
      entered();
      await pending;
      calls.push("online");
    },
    upload: async () => {},
    offline: async () => {
      calls.push("offline");
    },
    changed: () => {},
  });
  const start = controller.online();
  await ready;
  const stop = controller.offline();
  release();
  await Promise.all([start, stop]);
  assert.deepEqual(calls, ["online", "offline"]);
  assert.equal(controller.state.status, "OFFLINE");
});
test("location validation rejects stale, future, inaccurate and non-finite fixes", () => {
  assert.equal(usableFix(fix, now), true);
  for (const value of [
    { ...fix, accuracy_m: 101 },
    { ...fix, latitude: NaN },
    { ...fix, longitude: 181 },
    { ...fix, captured_at: new Date(now - 90001).toISOString() },
    { ...fix, captured_at: new Date(now + 30001).toISOString() },
  ])
    assert.equal(usableFix(value, now), false);
});
function setup() {
  const calls: string[] = [];
  let callback: (fix: Fix) => void = () => {};
  const controller = new SharingController({
    now: () => now,
    first: async () => fix,
    watch: async (next) => {
      callback = next;
      return () => {
        calls.push("stop");
      };
    },
    online: async () => {
      calls.push("online");
    },
    upload: async () => {
      calls.push("upload");
    },
    offline: async () => {
      calls.push("offline");
    },
    changed: () => {},
  });
  return { controller, calls, send: (value: Fix) => callback(value) };
}
test("explicit online consent publishes one first fix; offline stops the sensor before the server call", async () => {
  const { controller, calls } = setup();
  assert.deepEqual(calls, []);
  await controller.online();
  await controller.offline();
  assert.deepEqual(calls, ["online", "stop", "offline"]);
  assert.equal(controller.state.status, "OFFLINE");
});
test("old callbacks after offline cannot upload a point", async () => {
  const { controller, calls, send } = setup();
  await controller.online();
  await controller.offline();
  send({ ...fix, captured_at: new Date(now + 6000).toISOString() });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.includes("upload"), false);
});
test("permission failure never makes the business online", async () => {
  const calls: string[] = [];
  const controller = new SharingController({
    now: () => now,
    first: async () => {
      throw new Error("Location permission is required.");
    },
    watch: async () => () => {},
    online: async () => {
      calls.push("online");
    },
    upload: async () => {},
    offline: async () => {},
    changed: () => {},
  });
  await assert.rejects(controller.online(), /permission/);
  assert.deepEqual(calls, []);
  assert.equal(controller.state.status, "PAUSED");
});
test("failure starting the sensor rolls back online availability", async () => {
  const calls: string[] = [];
  const controller = new SharingController({
    now: () => now,
    first: async () => fix,
    watch: async () => {
      throw new Error("Sensor unavailable");
    },
    online: async () => {
      calls.push("online");
    },
    upload: async () => {},
    offline: async () => {
      calls.push("offline");
    },
    changed: () => {},
  });
  await assert.rejects(controller.online(), /Sensor/);
  assert.deepEqual(calls, ["online", "offline"]);
});
