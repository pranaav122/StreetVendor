import assert from "node:assert/strict";
import test from "node:test";
import {
  processBackgroundFixes,
  type Consent,
} from "../src/location/background-policy.ts";
const now = Date.now();
const consent: Consent = {
  userId: "user-a",
  familyId: "family-a",
  nonce: "consent-a",
  startedAt: now - 10000,
};
const access = (
  sub = "user-a",
  sid = "family-a",
  exp = Math.floor(now / 1000) + 600,
) => `header.${btoa(JSON.stringify({ sub, sid, exp }))}.signature`;
const fix = (age = 0) => ({
  latitude: 13.08,
  longitude: 80.27,
  accuracy_m: 10,
  captured_at: new Date(now - age).toISOString(),
});
test("headless uploads only the newest usable fix from the current consent period", async () => {
  const sent: unknown[] = [];
  await processBackgroundFixes({
    now,
    consent,
    access: access(),
    fixes: [fix(5000), fix(1000), fix(95000)],
    send: async (value) => {
      sent.push(value);
    },
    stop: async () => {
      throw new Error("Unexpected stop");
    },
  });
  assert.deepEqual(sent, [fix(1000)]);
});
test("missing, changed or expired session consent stops without uploading", async () => {
  for (const token of [
    null,
    access("user-b"),
    access("user-a", "family-b"),
    access("user-a", "family-a", Math.floor(now / 1000) - 1),
    "bad-jwt",
  ]) {
    let stopped = 0;
    await processBackgroundFixes({
      now,
      consent,
      access: token,
      fixes: [fix()],
      send: async () => {
        throw new Error("Must not publish");
      },
      stop: async () => {
        stopped++;
      },
    });
    assert.equal(stopped, 1);
  }
});
test("a revoked background request stops but a network error retains only future updates", async () => {
  for (const status of [401, 403, 409, 503]) {
    let stopped = 0;
    await processBackgroundFixes({
      now,
      consent,
      access: access(),
      fixes: [fix()],
      send: async () => {
        throw { status };
      },
      stop: async () => {
        stopped++;
      },
    });
    assert.equal(stopped, status === 503 ? 0 : 1);
  }
});
test("a fix captured before explicit consent is never replayed", async () => {
  await processBackgroundFixes({
    now,
    consent,
    access: access(),
    fixes: [fix(11000)],
    send: async () => {
      throw new Error("Must not replay");
    },
    stop: async () => {
      throw new Error("Unexpected stop");
    },
  });
});
