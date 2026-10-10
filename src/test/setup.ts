import { expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
import { transferableAbortController } from "node:util";

expect.extend(matchers);

// jsdom supplies its own AbortController realm but no Request implementation.
// React Router therefore reaches Node's Request with a jsdom AbortSignal, which
// Undici correctly rejects. Keep the test environment on Node's coherent Web
// API realm while retaining genuine abort events and cancellation semantics.
const nodeAbortController = transferableAbortController();
const NodeAbortController = nodeAbortController.constructor as typeof AbortController;
const NodeAbortSignal = nodeAbortController.signal.constructor as typeof AbortSignal;

Object.defineProperties(globalThis, {
  AbortController: { configurable: true, writable: true, value: NodeAbortController },
  AbortSignal: { configurable: true, writable: true, value: NodeAbortSignal }
});

Object.defineProperties(window, {
  AbortController: { configurable: true, writable: true, value: NodeAbortController },
  AbortSignal: { configurable: true, writable: true, value: NodeAbortSignal }
});
