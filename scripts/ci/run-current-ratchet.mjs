import fs from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compareRatchet } from "./cbh-ratchet-core.mjs";
import { normalizeEslintJson, normalizeFrontendTestOutput } from "./current-ratchet-normalizers.mjs";

const rootUrl = new URL("../..", import.meta.url);
const root = fileURLToPath(rootUrl);
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "client-lens-cbh-ratchet-"));
const resultPath = path.join(temporaryDirectory, "result.json");
const consolePath = path.join(temporaryDirectory, "console.txt");
const modes = {
  "frontend-tests": {
    baseline: "../../ci/cbh0-a/frontend-test-failures.json",
    executable: process.execPath,
    args: ["node_modules/vitest/vitest.mjs", "run", "--configLoader", "runner", "--maxWorkers", "4"],
    timeoutMs: 15 * 60 * 1000,
    outputPath: consolePath,
    normalize: normalizeFrontendTestOutput
  },
  "frontend-lint": {
    baseline: "../../ci/cbh0-a/frontend-lint-findings.json",
    executable: process.execPath,
    args: ["node_modules/eslint/bin/eslint.js", ".", "--format", "json", "--output-file", resultPath],
    timeoutMs: 5 * 60 * 1000,
    outputPath: resultPath,
    normalize: (output) => normalizeEslintJson(output, root)
  }
};

const mode = process.argv[2];
const config = modes[mode];
if (!config) throw new Error(`CBH_UNKNOWN_RATCHET_MODE:${mode ?? "MISSING"}`);

const consoleDescriptor = mode === "frontend-tests" ? fs.openSync(consolePath, "w") : null;
const child = spawn(config.executable, config.args, { cwd: rootUrl, env: process.env, shell: false, stdio: consoleDescriptor === null ? "inherit" : ["ignore", consoleDescriptor, consoleDescriptor] });
let timedOut = false;
const timeout = setTimeout(() => { timedOut = true; child.kill("SIGTERM"); }, config.timeoutMs);
child.on("error", (error) => { throw error; });
const exitCode = await new Promise((resolve) => child.on("close", resolve));
clearTimeout(timeout);
if (consoleDescriptor !== null) fs.closeSync(consoleDescriptor);
if (timedOut) {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  throw new Error(`CBH_RATCHET_COMMAND_TIMEOUT:${mode}:${config.timeoutMs}`);
}
let normalized;
let capturedOutput = "";
try {
  capturedOutput = fs.readFileSync(config.outputPath, "utf8");
  normalized = config.normalize(capturedOutput);
} catch (error) {
  console.error(`CBH_RATCHET_PARSE_FAILURE=${JSON.stringify({ mode, commandExitCode: exitCode, resultFileCreated: fs.existsSync(config.outputPath) })}`);
  throw error;
}
if (exitCode === null || (exitCode !== 0 && normalized.signatures.length === 0) || (exitCode === 0 && normalized.signatures.length > 0)) {
  const diagnosticTail = capturedOutput.slice(-20_000);
  if (diagnosticTail) console.error(diagnosticTail);
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  throw new Error(`CBH_RATCHET_COMMAND_EXECUTION_INCOHERENT:${mode}:${exitCode}`);
}
const baseline = JSON.parse(fs.readFileSync(new URL(config.baseline, import.meta.url), "utf8"));
const result = compareRatchet(baseline, normalized.signatures);
const report = { mode, commandExitCode: exitCode, ...result, totals: normalized.totals };
console.log(`CBH_RATCHET_RESULT=${JSON.stringify(report)}`);
fs.rmSync(temporaryDirectory, { recursive: true, force: true });
if (result.status !== "PASS") process.exitCode = 1;
