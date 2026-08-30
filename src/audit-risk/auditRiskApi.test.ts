import { afterEach, describe, expect, it, vi } from "vitest";

import { configureApiAuth } from "../api/client";
import { completeAudit, getAudit, getAuditExecution, getAuditFinding, listAuditFindings, listAuditTemplates, listAudits, listEligibleAuditFacilities, saveAuditResponse, startAudit } from "./auditRiskApi";

const auditId = "00000000-0000-4000-8000-000000000101";
const audit = {
  id: auditId,
  business_identifier: "AUDIT-2026-000001",
  audit_status: "IN_PROGRESS",
  started_at: "2026-08-30T01:00:00.000Z",
  completed_at: null,
  template: { id: "00000000-0000-4000-8000-000000000201", name: "Full Safety Audit", type: "FULL_SAFETY_AUDIT", version: 2 },
  facility: { id: "00000000-0000-4000-8000-000000000301", business_identifier: "FACILITY-2026-000001", name: "North Pool" },
  client: { id: "00000000-0000-4000-8000-000000000401", business_identifier: "CLIENT-2026-000001", name: "North Aquatics" },
  auditor: { id: "00000000-0000-4000-8000-000000000501", name: "Ana Auditor" }
};
const finding = {
  id: "00000000-0000-4000-8000-000000000601",
  business_identifier: "AUDIT-FINDING-2026-000001",
  audit: { id: audit.id, business_identifier: audit.business_identifier },
  facility: audit.facility,
  client: audit.client,
  category: "OPERATIONS",
  severity: "HIGH",
  title: "Missing inspection record",
  description: "The current inspection record was unavailable.",
  recommendation: null,
  is_resolved: false,
  identified_at: "2026-08-30T02:00:00.000Z",
  resolved_at: null,
  remediation: [{ id: "00000000-0000-4000-8000-000000000701", business_identifier: "CA-2026-000001", status: "OPEN" }]
};

afterEach(() => {
  configureApiAuth(null);
  vi.unstubAllGlobals();
});

describe("Audit Finding read API", () => {
  it("serializes only permission-composed severity and resolution filters", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), window.location.origin);
      expect(url.pathname).toBe("/api/v1/audit-findings");
      expect([...url.searchParams.entries()]).toEqual([["severity", "HIGH"], ["resolved", "false"]]);
      expect(init?.method).toBe("GET");
      return jsonResponse({ findings: [finding] });
    });
    vi.stubGlobal("fetch", fetchMock);

    await listAuditFindings({ severity: "HIGH", resolved: false });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("uses the Finding UUID as detail route authority", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), window.location.origin);
      expect(url.pathname).toBe(`/api/v1/audit-findings/${finding.id}`);
      expect(url.search).toBe("");
      expect(init?.method).toBe("GET");
      return jsonResponse(finding);
    }));

    await expect(getAuditFinding(finding.id)).resolves.toEqual(finding);
  });

  it.each([
    { ...finding, audit: { id: audit.id } },
    { ...finding, client: null },
    { ...finding, remediation: [{ id: finding.remediation[0].id, status: "OPEN" }] }
  ])("fails closed on malformed Finding context", async (malformed) => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(malformed)));
    await expect(getAuditFinding(finding.id)).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
  });
});

describe("Audit read API", () => {
  it("serializes only the supported status filter using semantic URL assertions", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = new URL(String(input), window.location.origin);
      expect(requestUrl.pathname).toBe("/api/v1/audits");
      expect([...requestUrl.searchParams.entries()]).toEqual([["status", "IN_PROGRESS"]]);
      expect(init?.method).toBe("GET");
      return jsonResponse({ audits: [audit] });
    });
    vi.stubGlobal("fetch", fetchMock);

    await listAudits({ status: "IN_PROGRESS" });

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("uses the Audit UUID as detail route authority", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = new URL(String(input), window.location.origin);
      expect(requestUrl.pathname).toBe(`/api/v1/audits/${auditId}`);
      expect(requestUrl.search).toBe("");
      expect(init?.method).toBe("GET");
      return jsonResponse(audit);
    });
    vi.stubGlobal("fetch", fetchMock);

    await getAudit(auditId);

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects malformed nested Audit context", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ audits: [{ ...audit, facility: { id: audit.facility.id } }] })));
    await expect(listAudits()).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
  });

  it("uses exact selector discovery paths without mutation fields", async () => {
    const responses = [
      { facilities: [{ id: "00000000-0000-4000-8000-000000000301", business_identifier: "FACILITY-2026-000001", name: "North Pool", operational_status: "ACTIVE", client: { id: "00000000-0000-4000-8000-000000000401", business_identifier: "CLIENT-2026-000001", name: "North Aquatics" } }] },
      [{ id: "00000000-0000-4000-8000-000000000201", name: "Full Safety Audit", type: "FULL_SAFETY_AUDIT", version: 2, description: null, is_active: true }]
    ];
    const paths: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = new URL(String(input), window.location.origin);
      paths.push(requestUrl.pathname);
      expect(requestUrl.search).toBe("");
      expect(init?.method).toBe("GET");
      return jsonResponse(responses.shift());
    }));

    await listEligibleAuditFacilities();
    await listAuditTemplates();

    expect(paths).toEqual(["/api/v1/audits/eligible-facilities", "/api/v1/audit-templates"]);
  });

  it("sends the exact governed command and Idempotency-Key", async () => {
    const command = { templateId: audit.template.id, facilityId: audit.facility.id };
    const key = "00000000-0000-4000-8000-000000000901";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = new URL(String(input), window.location.origin);
      const headers = new Headers(init?.headers);
      expect(requestUrl.pathname).toBe("/api/v1/audits/start");
      expect(requestUrl.search).toBe("");
      expect(init?.method).toBe("POST");
      expect(headers.get("Idempotency-Key")).toBe(key);
      expect(JSON.parse(String(init?.body))).toEqual(command);
      expect(Object.keys(JSON.parse(String(init?.body))).sort()).toEqual(["facilityId", "templateId"]);
      return jsonResponse(audit);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(startAudit(command, key)).resolves.toEqual(audit);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("fails closed on malformed selector context", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ facilities: [{ id: audit.facility.id, name: "North Pool", client: null }] })));
    await expect(listEligibleAuditFacilities()).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
  });
});

describe("Audit execution API", () => {
  it("uses the Audit UUID for the authoritative execution GET and rejects malformed nested authority", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), window.location.origin);
      expect(url.pathname).toBe(`/api/v1/audits/${auditId}/execution`);
      expect(url.search).toBe("");
      expect(init?.method).toBe("GET");
      return jsonResponse(executionProjection());
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(getAuditExecution(auditId)).resolves.toMatchObject({ audit: { id: auditId }, legacy_history_excluded: true });

    fetchMock.mockResolvedValueOnce(jsonResponse({ ...executionProjection(), definition: { ...executionProjection().definition, schema: { sections: [{ section_code: "S", title: "Section", fields: [{ field_id: "x", label: "Unknown", type: "mystery", required: true, source_required: true, edit_authority: "USER_RESPONSE", response_kind: "TEXT" }] }] } } }));
    await expect(getAuditExecution(auditId)).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
  });

  it.each([null, 3] as const)("posts the exact versioned section command with expectedVersion %s", async (expectedVersion) => {
    const command = { auditId, templateId: audit.template.id, sectionCode: "OPERATIONS", expectedVersion, responsePayload: { check: false } };
    const key = `save-key-${String(expectedVersion)}`;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), window.location.origin);
      expect(url.pathname).toBe("/api/v1/audit-responses");
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get("Idempotency-Key")).toBe(key);
      expect(JSON.parse(String(init?.body))).toEqual(command);
      return jsonResponse(responseResult(expectedVersion === null ? 1 : 4));
    }));
    await expect(saveAuditResponse(command, key)).resolves.toMatchObject({ response: { version: expectedVersion === null ? 1 : 4 } });
  });

  it("posts completion by UUID with an independent key and no invented body", async () => {
    const key = "completion-key";
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), window.location.origin);
      expect(url.pathname).toBe(`/api/v1/audits/${auditId}/complete`);
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get("Idempotency-Key")).toBe(key);
      expect(init?.body).toBeUndefined();
      return jsonResponse({ audit: { ...audit, audit_status: "APPROVED", completed_at: "2026-08-30T04:00:00.000Z" }, findings: [], replayed: false });
    }));
    await expect(completeAudit(auditId, key)).resolves.toMatchObject({ replayed: false });
  });
});

function executionProjection() {
  return {
    audit,
    definition: { template_id: audit.template.id, version: 2, checksum: "a".repeat(64), schema: { sections: [{ section_code: "OPERATIONS", title: "Operations", fields: [{ field_id: "check", label: "Check", type: "boolean", required: true, source_required: true, edit_authority: "USER_RESPONSE", response_kind: "BOOLEAN" }] }] } },
    responses: [], findings: [], completeness: { is_complete: false, incomplete: [{ section_code: "OPERATIONS", field_id: "check" }] }, completion_eligible: false, legacy_history_excluded: true
  };
}

function responseResult(version: number) {
  return { response: { id: "00000000-0000-4000-8000-000000000801", audit_id: auditId, template_id: audit.template.id, section_code: "OPERATIONS", response_payload: { check: false }, version, checksum: "b".repeat(64), submitted_at: "2026-08-30T03:00:00.000Z" }, completeness: { is_complete: true, incomplete: [] } };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}
