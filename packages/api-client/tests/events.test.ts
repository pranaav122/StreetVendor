import assert from "node:assert/strict";
import { test } from "node:test";
import { parseServerMessage } from "../../shared-types/src/index.ts";

test("unrecognized and malformed socket messages cannot enter application state", () => {
  for (const value of [
    "not json",
    JSON.stringify({
      type: "REQUEST_CHANGED",
      request_id: "not-a-uuid",
      version: 0,
    }),
    JSON.stringify({ type: "SOMETHING_ELSE" }),
  ]) {
    assert.equal(parseServerMessage(value), null);
  }
});

test("heartbeat reply is recognized without requiring private visit data", () => {
  const message = { type: "PONG", id: "11111111-1111-4111-8111-111111111111" };
  assert.deepEqual(parseServerMessage(JSON.stringify(message)), message);
});
