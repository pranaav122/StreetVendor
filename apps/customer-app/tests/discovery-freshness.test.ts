import assert from "node:assert/strict";
import { test } from "node:test";
import { locationTimestampFresh } from "../src/features/visits/intent.ts";
test("discovery expires cached fixes and rejects invalid or excessive future timestamps", () => {
  const now = Date.now();
  assert.equal(locationTimestampFresh(new Date(now).toISOString(), now), true);
  assert.equal(
    locationTimestampFresh(new Date(now - 91000).toISOString(), now),
    false,
  );
  assert.equal(
    locationTimestampFresh(new Date(now + 31000).toISOString(), now),
    false,
  );
  assert.equal(locationTimestampFresh("invalid", now), false);
});
