import fs from "node:fs";
import { validateBaseline } from "./cbh-ratchet-core.mjs";

const ratchets = [
  "../../ci/cbh0-a/frontend-test-failures.json",
  "../../ci/cbh0-a/frontend-lint-findings.json"
];

for (const relative of ratchets) {
  const url = new URL(relative, import.meta.url);
  const baseline = JSON.parse(fs.readFileSync(url, "utf8"));
  const result = validateBaseline(baseline);
  if (result.status !== "PASS") throw new Error(`CBH_BASELINE_INVALID:${url.pathname}`);
}
console.log(JSON.stringify({ status: "PASS", ratchets: ratchets.length }));
