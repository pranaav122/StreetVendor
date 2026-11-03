import assert from "node:assert/strict";
import { test } from "node:test";
import { translate } from "../src/copy.ts";
test("Tamil interface text is available while English and unknown content stay intact", () => {
  assert.equal(translate("ta", "Sign in"), "உள்நுழையவும்");
  assert.equal(
    translate("ta", "Around your meeting point"),
    "சந்திப்பு இடத்திற்கு அருகில்",
  );
  assert.equal(translate("en", "Sign in"), "Sign in");
  assert.equal(
    translate("ta", "A business name not in the interface dictionary"),
    "A business name not in the interface dictionary",
  );
});
