import assert from "node:assert/strict";
import test from "node:test";
import { normalizeEslintJson, normalizeFrontendTestOutput, normalizeVitestJson } from "./current-ratchet-normalizers.mjs";

test("normalizes Vitest failures and requires coherent totals", () => {
  const output = " FAIL  src/a.test.tsx > suite > fails safely\n Tests  1 failed | 2 passed (3)\n";
  assert.deepEqual(normalizeFrontendTestOutput(output), { signatures: ["src/a.test.tsx|suite|fails safely"], totals: { failed: 1, passed: 2, tests: 3 } });
  assert.deepEqual(normalizeFrontendTestOutput("Tests  1 passed (1)"), { signatures: [], totals: { failed: 0, passed: 1, tests: 1 } });
  assert.throws(() => normalizeFrontendTestOutput("test process crashed"), /INCOMPLETE/);
});

test("normalizes Vitest JSON using repository-relative test identities", () => {
  const output = JSON.stringify({ numFailedTests: 1, numPassedTests: 2, numTotalTests: 3, testResults: [{ name: "C:\\repo\\src\\a.test.tsx", assertionResults: [{ ancestorTitles: ["suite"], title: "fails safely", status: "failed" }, { ancestorTitles: ["suite"], title: "passes", status: "passed" }] }] });
  assert.deepEqual(normalizeVitestJson(output, "C:\\repo"), { signatures: ["src/a.test.tsx|suite|fails safely"], totals: { failed: 1, passed: 2, tests: 3 } });
});

test("normalizes ESLint JSON using repository-relative identities", () => {
  const output = JSON.stringify([{ filePath: "C:\\repo\\src\\a.ts", messages: [{ ruleId: "rule", severity: 2, line: 3, column: 4 }], errorCount: 1, warningCount: 0 }]);
  assert.deepEqual(normalizeEslintJson(output, "C:\\repo"), { signatures: ["src/a.ts|rule|2|3|4"], totals: { errors: 1, warnings: 0 } });
});
