import assert from "node:assert/strict";
import { test } from "node:test";
import { extractRecoveryLink } from "../src/features/auth/recovery-link.ts";

test("recovery accepts a bounded fragment token and recognizes native links", () => {
  const token = "a".repeat(64);
  assert.deepEqual(
    extractRecoveryLink(`https://example.com/reset-password#token=${token}`),
    { kind: "reset-password", token },
  );
  assert.deepEqual(
    extractRecoveryLink(
      `mystreetvendor-customer://verify-email#token=${token}`,
    ),
    { kind: "verify-email", token },
  );
});

test("query tokens, duplicate values and unrelated paths are rejected", () => {
  const token = "a".repeat(64);
  for (const raw of [
    `https://example.com/reset-password?token=${token}`,
    `https://example.com/reset-password#token=${token}&token=${token}`,
    `https://example.com/account#token=${token}`,
    "not a URL",
    "https://example.com/reset-password#token=short",
  ])
    assert.equal(extractRecoveryLink(raw), null);
});
