const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, "g");

export function stripAnsi(value) {
  return value.replace(ANSI, "");
}

export function normalizeFrontendTestOutput(output) {
  const text = stripAnsi(output);
  const signatures = [...text.matchAll(/^ FAIL {2}(.+?) > (.+?) > (.+)$/gm)].map((match) => `${match[1].trim()}|${match[2].trim()}|${match[3].trim()}`);
  const summary = text.match(/Tests\s+(?:(\d+) failed\s+\|\s+)?(\d+) passed\s+\((\d+)\)/);
  if (!summary) throw new Error("CBH_FRONTEND_TEST_OUTPUT_INCOMPLETE");
  const failed = Number(summary[1] ?? 0);
  if (failed !== signatures.length) throw new Error("CBH_FRONTEND_TEST_FAILURE_COUNT_MISMATCH");
  return { signatures, totals: { failed, passed: Number(summary[2]), tests: Number(summary[3]) } };
}

export function normalizeVitestJson(output, repositoryRoot) {
  let report;
  try {
    report = JSON.parse(output);
  } catch {
    throw new Error("CBH_VITEST_OUTPUT_INVALID");
  }
  const root = repositoryRoot.replaceAll("\\", "/").replace(/\/$/, "");
  const signatures = report.testResults.flatMap((file) => {
    const absolute = file.name.replaceAll("\\", "/");
    const relative = absolute.startsWith(`${root}/`) ? absolute.slice(root.length + 1) : absolute;
    return file.assertionResults.filter((test) => test.status === "failed").map((test) => `${relative}|${test.ancestorTitles.join(" > ")}|${test.title}`);
  });
  return { signatures, totals: { failed: report.numFailedTests, passed: report.numPassedTests, tests: report.numTotalTests } };
}

export function normalizeEslintJson(output, repositoryRoot) {
  let reports;
  try {
    reports = JSON.parse(output);
  } catch {
    throw new Error("CBH_ESLINT_OUTPUT_INVALID");
  }
  const root = repositoryRoot.replaceAll("\\", "/").replace(/\/$/, "");
  const signatures = reports.flatMap((report) => report.messages.map((message) => {
    const absolute = report.filePath.replaceAll("\\", "/");
    const relative = absolute.startsWith(`${root}/`) ? absolute.slice(root.length + 1) : absolute;
    return `${relative}|${message.ruleId}|${message.severity}|${message.line}|${message.column}`;
  }));
  return { signatures, totals: { errors: reports.reduce((sum, report) => sum + report.errorCount, 0), warnings: reports.reduce((sum, report) => sum + report.warningCount, 0) } };
}
