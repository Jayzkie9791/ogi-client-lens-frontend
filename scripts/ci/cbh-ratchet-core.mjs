import { createHash } from "node:crypto";

export function canonicalSignatures(signatures) {
  if (!Array.isArray(signatures) || signatures.some((value) => typeof value !== "string" || value.length === 0)) {
    throw new TypeError("Ratchet signatures must be non-empty strings.");
  }
  const canonical = [...new Set(signatures)].sort();
  if (canonical.length !== signatures.length) throw new Error("Ratchet signatures must be unique.");
  return canonical;
}

export function signatureChecksum(signatures) {
  return createHash("sha256").update(canonicalSignatures(signatures).join("\n")).digest("hex");
}

export function compareRatchet(baseline, currentSignatures) {
  if (!baseline || baseline.schemaVersion !== 1 || !Number.isInteger(baseline.maximumCount)) throw new Error("Unsupported or malformed CBH ratchet baseline.");
  const expected = canonicalSignatures(baseline.signatures);
  if (expected.length !== baseline.maximumCount) throw new Error("Baseline count does not match its signatures.");
  if (signatureChecksum(expected) !== baseline.signatureChecksum) throw new Error("Baseline checksum mismatch.");
  const current = canonicalSignatures(currentSignatures);
  const expectedSet = new Set(expected);
  const currentSet = new Set(current);
  const unexpected = current.filter((value) => !expectedSet.has(value));
  const resolved = expected.filter((value) => !currentSet.has(value));
  return {
    status: unexpected.length === 0 && current.length <= baseline.maximumCount ? "PASS" : "FAIL",
    currentCount: current.length,
    maximumCount: baseline.maximumCount,
    unexpected,
    resolved,
    currentChecksum: signatureChecksum(current)
  };
}

export function validateBaseline(baseline) {
  return compareRatchet(baseline, baseline.signatures);
}
