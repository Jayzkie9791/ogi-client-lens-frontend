import { readFile } from "node:fs/promises";
import { describe,expect,it } from "vitest";

describe("CFAC-4S8B reviewer queue UX contract",()=>{
  it("registers a permission-gated distinct queue and durable review return",async()=>{
    const [routes,router,shell,page,context]=await Promise.all([read("src/app/routePaths.ts"),read("src/app/router.tsx"),read("src/ui/layout/AppShell.tsx"),read("src/oets/CanonicalReviewQueuePage.tsx"),read("src/oets/evidenceReturnContext.ts")]);
    expect(routes).toContain('canonicalReviewQueue: "/workbench/operations/awaiting-review"');
    expect(router).toContain("CanonicalReviewQueuePage");
    expect(shell).toMatch(/Awaiting My Review.*canonicalReviewPermission/);
    expect(page).toContain('{kind:"REVIEW_QUEUE"}');
    expect(context).toContain('kind: "REVIEW_QUEUE"');
  });
  it("opens assessed Drafts read-only and preserves only canonical review action",async()=>{
    const record=await read("src/oets/OperationalEvidenceRecordPage.tsx");
    expect(record).toContain('canonicalReviewMode = durableReturnContext?.kind === "REVIEW_QUEUE"');
    expect(record).toMatch(/canEditDraft =[\s\S]*!canonicalReviewMode/);
    expect(record).toMatch(/canAttestDraft =[\s\S]*!canonicalReviewMode/);
    expect(record).toMatch(/canDiscardDraft =[\s\S]*!canonicalReviewMode/);
    expect(record).toContain("Read-only canonical review.");
    expect(record).toContain('if(role==="REVIEWER")navigate(routes.canonicalReviewQueue)');
  });
  it("does not modify My Drafts or reuse the post-finalization governance queue",async()=>{
    const page=await read("src/oets/CanonicalReviewQueuePage.tsx");
    expect(page).not.toContain("listOperationalEvidenceRecords");
    expect(page).not.toContain("GovernanceQueue");
    expect(page).not.toContain("Save Draft");
    expect(page).not.toContain("Discard Draft");
  });
});

const read=(path:string)=>readFile(path,"utf8");
