# Codebase health gates

Use Node 22.18.0 and npm 10.9.3.

- `npm run cbh:protected` is a strict green protected-runtime gate.
- `npm run cbh:ratchet:current` executes the complete test and lint surfaces,
  then compares normalized failure identities with `cbh0-a`.
- `npm run cbh:ratchet:verify` checks committed baseline integrity only.

Ratchet success means no regression beyond recorded debt; it does not mean the
repository is globally green. Missing, partial, timed-out, or substituted
results fail closed. The runner never updates a baseline.
