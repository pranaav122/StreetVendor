import assert from "node:assert/strict";
import test from "node:test";
import { translate } from "../src/copy.ts";
test("Partner visit and location controls translate without changing business data", () => {
  for (const value of [
    "Accept visit",
    "Decline visit",
    "Complete visit",
    "Go offline",
    "Go online",
    "Location settings",
    "I can’t make it",
    "I’m on my way",
    "Need help with this visit?",
    "Account deletion",
    "Save shop details",
    "Send for approval",
    "Customer visits",
    "Visit accepted",
  ])
    assert.notEqual(translate("ta", value), value);
  assert.equal(
    translate("ta", "Synthetic market stall"),
    "Synthetic market stall",
  );
  assert.equal(translate("en", "Accept visit"), "Accept visit");
});
