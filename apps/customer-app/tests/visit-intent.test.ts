import assert from "node:assert/strict";
import { test } from "node:test";
import { VisitIntent, trackingFresh } from "../src/features/visits/intent.ts";

test("network retries reuse an intent key until the selected meeting payload changes", () => {
  let next = 0;
  const intent = new VisitIntent(() => `key-${++next}`);
  const meeting = {
    point: { latitude: 13.0827, longitude: 80.2707 },
    label: "Public market",
  };
  const first = intent.prepare("vendor-id", meeting);
  assert.equal(intent.prepare("vendor-id", meeting).key, first.key);
  assert.notEqual(
    intent.prepare("vendor-id", { ...meeting, label: "Another public market" })
      .key,
    first.key,
  );
  assert.notEqual(
    new VisitIntent(() => `key-${++next}`).prepare("vendor-id", meeting).key,
    first.key,
  );
});

test("tracking never calls an old, future or inaccurate point fresh", () => {
  const now = Date.now();
  const fix = {
    latitude: 13.08,
    longitude: 80.27,
    accuracy_m: 10,
    captured_at: new Date(now).toISOString(),
  };
  assert.equal(trackingFresh(fix, now), true);
  assert.equal(
    trackingFresh(
      { ...fix, captured_at: new Date(now - 91000).toISOString() },
      now,
    ),
    false,
  );
  assert.equal(
    trackingFresh(
      { ...fix, captured_at: new Date(now + 31000).toISOString() },
      now,
    ),
    false,
  );
  assert.equal(trackingFresh({ ...fix, accuracy_m: 101 }, now), false);
  assert.equal(trackingFresh({ ...fix, captured_at: "invalid" }, now), false);
});
