export type RecommendationKind = "RECOMMENDATION" | "ACTION";

export interface ExecutivePresentationRecommendation {
  kind: RecommendationKind;
  text: string;
}

export interface ExecutivePresentationSection {
  heading: string;
  scope: string;
  classification?: string | null;
  findings: string[];
  recommendations: ExecutivePresentationRecommendation[];
}

export interface ExecutivePresentationContent {
  schemaVersion: "1.0";
  sections: ExecutivePresentationSection[];
}

export interface ExecutivePresentationDraft {
  id: string;
  ariResultId: string;
  schemaVersion: "1.0";
  lifecycle: "WORKING_DRAFT";
  content: ExecutivePresentationContent;
  revision: number;
  contentChecksum: string;
  createdByUserId: string;
  createdAt: string;
  updatedByUserId: string;
  updatedAt: string;
}

export interface ExecutivePresentationDraftEnvelope {
  draft: ExecutivePresentationDraft;
  replayed?: boolean;
  unchanged?: boolean;
}

export interface ExecutivePresentationDraftResponse {
  envelope: ExecutivePresentationDraftEnvelope;
  etag: string;
}

export const emptyExecutivePresentationContent = (): ExecutivePresentationContent => ({ schemaVersion: "1.0", sections: [] });

