import assert from "node:assert/strict";
import test from "node:test";
import { compareRatchet, signatureChecksum } from "./cbh-ratchet-core.mjs";

test("frontend ratchet rejects a replacement finding and accepts resolved debt", () => {
  const signatures = ["lint:a", "lint:b"];
  const baseline = { schemaVersion: 1, maximumCount: 2, signatures, signatureChecksum: signatureChecksum(signatures) };
  assert.equal(compareRatchet(baseline, ["lint:a"]).status, "PASS");
  assert.equal(compareRatchet(baseline, ["lint:a", "lint:c"]).status, "FAIL");
});
