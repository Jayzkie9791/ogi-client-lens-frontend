import { beforeEach, describe, expect, it, vi } from "vitest";

import { executiveSummaryFixture } from "../executive-findings/executiveSummaryTestFixture";
import { createExecutivePresentationDraft, executivePresentationPath, saveExecutivePresentationDraft } from "./executivePresentationApi";
import { emptyExecutivePresentationContent } from "./executivePresentationTypes";

const request = vi.hoisted(() => vi.fn());
vi.mock("../api/client", () => ({ apiRequestWithMetadata: request }));

const envelope = { draft: { id: "draft-1", ariResultId: "00000000-0000-4000-8000-000000000001", schemaVersion: "1.0", lifecycle: "WORKING_DRAFT", content: emptyExecutivePresentationContent(), revision: 1, contentChecksum: "a".repeat(64), createdByUserId: "actor", createdAt: "2026-10-01T00:00:00Z", updatedByUserId: "actor", updatedAt: "2026-10-01T00:00:00Z" } };

beforeEach(() => request.mockReset());

describe("EPA5 Executive Presentation API adapter", () => {
  it("uses the exact EF4A Client, Facility, and immutable ARI identity", () => {
    expect(executivePresentationPath(executiveSummaryFixture())).toBe("/api/v1/clients/client-1/facilities/facility-1/operational-risk-index/00000000-0000-4000-8000-000000000001/executive-presentation");
  });

  it("retains the strong ETag and sends it unchanged through If-Match", async () => {
    request.mockResolvedValue({ data: envelope, headers: new Headers({ ETag: '"epa-draft-r1"' }), status: 201 });
    const created = await createExecutivePresentationDraft(executiveSummaryFixture());
    expect(created.etag).toBe('"epa-draft-r1"');
    request.mockResolvedValue({ data: { ...envelope, draft: { ...envelope.draft, revision: 2 } }, headers: new Headers({ ETag: '"epa-draft-r2"' }), status: 200 });
    await saveExecutivePresentationDraft(executiveSummaryFixture(), emptyExecutivePresentationContent(), created.etag);
    expect(request.mock.calls[1]?.[1]).toMatchObject({ method: "PUT", headers: { "If-Match": '"epa-draft-r1"' } });
  });

  it("fails closed when a successful response omits a valid strong ETag", async () => {
    request.mockResolvedValue({ data: envelope, headers: new Headers(), status: 200 });
    await expect(createExecutivePresentationDraft(executiveSummaryFixture())).rejects.toThrow("valid strong ETag");
  });
});

