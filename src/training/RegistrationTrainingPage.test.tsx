import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureApiAuth } from "../api/client";
import { AppProviders } from "../app/providers/AppProviders";
import { appRoutes } from "../app/router";
import { routes } from "../app/routePaths";
import { getRefreshTokenStorageKey } from "../auth/storage";
import { AuthenticatedSession } from "../auth/types";
import { RegistrationClient } from "../registration/registrationClientApi";
import { RegistrationPersonnel } from "../registration/registrationPersonnelApi";
import {
  TrainingAttendanceEvidenceWorkspace,
  TrainingEnrollment,
  TrainingEvidenceWorkspace,
  TrainingEvidenceWorkspaceRecord,
  TrainingEvidenceWorkspaceSlot,
  TrainingSession,
  TrainingTrainee
} from "./trainingApi";

const traineeAId = "00000000-0000-4000-8000-000000810001";
const traineeBId = "00000000-0000-4000-8000-000000810002";
const staffAId = "00000000-0000-4000-8000-000000820001";
const clientAId = "00000000-0000-4000-8000-000000830001";
const clientBId = "00000000-0000-4000-8000-000000830002";
const trainingSessionAId = "00000000-0000-4000-8000-000000860001";

const baseSession: AuthenticatedSession = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "operator@example.test",
  username: null,
  fullName: "Operator One",
  status: "ACTIVE",
  clientId: null,
  facilityScopeMode: null,
  facilityIds: [],
  roles: ["Registration"],
  permissions: [
    "view_client",
    "view_facility",
    "view_staff_member",
    "view_training",
    "register_trainee",
    "link_training_staff_member",
    "create_training_enrollment",
    "assign_training_session",
    "submit_operational_evidence"
  ]
};

const traineeA: TrainingTrainee = {
  id: traineeAId,
  student_number: null,
  full_name: "Jane Smith",
  email: "jane.smith@example.test",
  phone_number: "+63 900 000 1001",
  notes: "External trainee",
  created_at: "2026-08-17T01:00:00.000Z",
  updated_at: "2026-08-17T02:00:00.000Z",
  deleted_at: null,
  staff_member_links: []
};

const linkedTraineeA: TrainingTrainee = {
  ...traineeA,
  staff_member_links: [
    {
      id: "00000000-0000-4000-8000-000000840001",
      trainee_id: traineeAId,
      staff_member_id: staffAId,
      created_at: "2026-08-17T03:00:00.000Z",
      ended_at: null,
      staff_member: {
        id: staffAId,
        client_id: clientAId,
        full_name: "Ana Santos",
        email: "ana.santos@example.test"
      }
    }
  ]
};

const traineeB: TrainingTrainee = {
  id: traineeBId,
  student_number: "OGI-STU-2026-0002",
  full_name: "John Santos",
  email: null,
  phone_number: null,
  notes: null,
  created_at: "2026-08-18T01:00:00.000Z",
  updated_at: "2026-08-18T02:00:00.000Z",
  deleted_at: null,
  staff_member_links: []
};

const createdTrainee: TrainingTrainee = {
  id: "00000000-0000-4000-8000-000000810003",
  student_number: null,
  full_name: "New Trainee",
  email: "new.trainee@example.test",
  phone_number: null,
  notes: null,
  created_at: "2026-08-19T01:00:00.000Z",
  updated_at: "2026-08-19T01:00:00.000Z",
  deleted_at: null,
  staff_member_links: []
};

const clientA: RegistrationClient = {
  id: clientAId,
  organization_name: "Ocean Guard International",
  contact_email: "admin@ogiofficial.com",
  contact_phone: null,
  status: "ACTIVE",
  address: null,
  country: "Philippines",
  notes: null,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-02T00:00:00.000Z",
  deleted_at: null
};

const clientB: RegistrationClient = {
  id: clientBId,
  organization_name: "Bluewater Resorts",
  contact_email: null,
  contact_phone: null,
  status: "ACTIVE",
  address: null,
  country: "United States",
  notes: null,
  created_at: "2026-08-03T00:00:00.000Z",
  updated_at: "2026-08-04T00:00:00.000Z",
  deleted_at: null
};

const staffA: RegistrationPersonnel = {
  id: staffAId,
  client_id: clientAId,
  user_id: null,
  full_name: "Ana Santos",
  email: "ana.santos@example.test",
  phone_number: "+63 900 000 2001",
  employment_status: "ACTIVE",
  hire_date: "2026-01-15",
  notes: null,
  created_at: "2026-08-09T00:00:00.000Z",
  updated_at: "2026-08-10T00:00:00.000Z",
  deleted_at: null
};

const staffB: RegistrationPersonnel = {
  id: "00000000-0000-4000-8000-000000820002",
  client_id: clientBId,
  user_id: null,
  full_name: "Jamie Brooks",
  email: null,
  phone_number: null,
  employment_status: "SEASONAL",
  hire_date: null,
  notes: null,
  created_at: "2026-08-11T00:00:00.000Z",
  updated_at: "2026-08-12T00:00:00.000Z",
  deleted_at: null
};

const enrollmentA: TrainingEnrollment = {
  id: "00000000-0000-4000-8000-000000850001",
  trainee_id: traineeAId,
  program_code: "OPEN_WATER_GUARDIAN",
  program: {
    program_code: "OPEN_WATER_GUARDIAN",
    certification_level: "L3",
    display_name: "Open Water Guardian",
    qualification_label: "Open Water Guardian",
    required_training_hours: 80,
    minimum_age: 18
  },
  client_id: clientAId,
  training_session_id: null,
  enrolled_at: "2026-08-17T04:00:00.000Z",
  notes: "Sponsored cohort",
  created_at: "2026-08-17T04:00:00.000Z",
  updated_at: "2026-08-17T04:00:00.000Z",
  deleted_at: null,
  trainee: {
    id: traineeAId,
    student_number: null,
    full_name: "Jane Smith",
    email: "jane.smith@example.test"
  },
  client: {
    id: clientAId,
    organization_name: "Ocean Guard International",
    status: "ACTIVE"
  },
  training_session: null
};

const trainingSessionA: TrainingSession = {
  id: trainingSessionAId,
  training_title: "Open Water Guardian Cohort A",
  operational_skill: "OPEN_WATER_RESCUE",
  training_start_date: "2026-08-22T08:00:00.000Z",
  training_end_date: "2026-08-22T16:00:00.000Z",
  duration_minutes: 480,
  facility_id: "00000000-0000-4000-8000-000000870001",
  instructor_name: "Braven Burrows",
  instructor_license_number: "OGI-INS-2026-0001",
  instructor_staff_member_id: null,
  training_notes: "Pool and open water practical block.",
  created_at: "2026-08-17T05:00:00.000Z",
  updated_at: "2026-08-17T05:00:00.000Z",
  facility: {
    id: "00000000-0000-4000-8000-000000870001",
    client_id: clientAId,
    facility_name: "Makati Training Pool",
    operational_status: "ACTIVE"
  },
  instructor_staff_member: null
};

const assignedEnrollmentA: TrainingEnrollment = {
  ...enrollmentA,
  training_session_id: trainingSessionAId,
  training_session: {
    id: trainingSessionAId,
    training_title: trainingSessionA.training_title,
    training_start_date: trainingSessionA.training_start_date,
    training_end_date: trainingSessionA.training_end_date,
    facility_id: trainingSessionA.facility_id
  }
};

const independentEnrollmentB: TrainingEnrollment = {
  id: "00000000-0000-4000-8000-000000850002",
  trainee_id: traineeBId,
  program_code: "GUARDIAN_RESPONDER",
  program: {
    program_code: "GUARDIAN_RESPONDER",
    certification_level: "L1",
    display_name: "Guardian Responder",
    qualification_label: "Guardian Responder",
    required_training_hours: 40,
    minimum_age: 16
  },
  client_id: null,
  training_session_id: null,
  enrolled_at: "2026-08-18T04:00:00.000Z",
  notes: null,
  created_at: "2026-08-18T04:00:00.000Z",
  updated_at: "2026-08-18T04:00:00.000Z",
  deleted_at: null,
  trainee: {
    id: traineeBId,
    student_number: "OGI-STU-2026-0002",
    full_name: "John Santos",
    email: null
  },
  client: null,
  training_session: null
};

const skillsDraftId = "00000000-0000-4000-8000-000000880001";
const knowledgeRecordId = "00000000-0000-4000-8000-000000880002";
const readinessRecordId = "00000000-0000-4000-8000-000000880003";
const attendanceDraftId = "00000000-0000-4000-8000-000000880004";
const attendanceSubmittedId = "00000000-0000-4000-8000-000000880005";

const assignedIndependentEnrollmentB: TrainingEnrollment = {
  ...independentEnrollmentB,
  training_session_id: trainingSessionAId,
  training_session: {
    id: trainingSessionAId,
    training_title: trainingSessionA.training_title,
    training_start_date: trainingSessionA.training_start_date,
    training_end_date: trainingSessionA.training_end_date,
    facility_id: trainingSessionA.facility_id
  }
};

function attendanceEvidenceMetadata(
  evidenceRecordId: string,
  lifecycleState = "DRAFT"
) {
  return {
    evidence_record_id: evidenceRecordId,
    template_code: "OGI_F022_COURSE_ATTENDANCE_VERIFICATION_RECORD" as const,
    template_name: "Course Attendance Verification Record",
    document_number: "OGI F-022",
    lifecycle_state: lifecycleState,
    client_id: clientAId,
    facility_id: trainingSessionA.facility_id,
    submitted_at:
      lifecycleState === "DRAFT" ? null : "2026-08-22T16:30:00.000Z",
    created_at: "2026-08-22T16:00:00.000Z"
  };
}

function attendanceEvidenceRecord(
  evidenceRecordId: string,
  roster: readonly TrainingEnrollment[],
  overrides: Partial<TrainingAttendanceEvidenceWorkspace["history"][number]> = {}
): TrainingAttendanceEvidenceWorkspace["history"][number] {
  return {
    evidence: attendanceEvidenceMetadata(
      evidenceRecordId,
      overrides.evidence?.lifecycle_state ?? "DRAFT"
    ),
    roster,
    linked_enrollment_ids: overrides.linked_enrollment_ids ?? [],
    roster_count: roster.length,
    linked_count: overrides.linked_count ?? 0,
    can_link: overrides.can_link ?? false
  };
}

function attendanceEvidenceWorkspace(
  overrides: Partial<TrainingAttendanceEvidenceWorkspace> = {}
): TrainingAttendanceEvidenceWorkspace {
  const eligibleEnrollments = overrides.eligible_enrollments ?? [
    {
      enrollment: assignedEnrollmentA,
      attendance_linked_record_ids: []
    }
  ];

  return {
    session: trainingSessionA,
    eligible_enrollments: eligibleEnrollments,
    active_draft: overrides.active_draft ?? null,
    history: overrides.history ?? [],
    can_create_draft: overrides.can_create_draft ?? true
  };
}

function attendanceWorkspaceRoute(
  workspaces: readonly TrainingAttendanceEvidenceWorkspace[] = [
    attendanceEvidenceWorkspace()
  ]
): MockRoute {
  return {
    url: `/api/v1/training/sessions/${trainingSessionAId}/attendance-evidence-workspace`,
    responses: workspaces.map((workspace) => ({ status: 200, body: workspace }))
  };
}

function attendanceDraftResponse() {
  return {
    evidence_record_id: attendanceDraftId,
    template_code: "OGI_F022_COURSE_ATTENDANCE_VERIFICATION_RECORD",
    template_version_id: "00000000-0000-4000-8000-000000880104",
    template_version: "1.0",
    schema_version: "1.0",
    client_id: clientAId,
    facility_id: trainingSessionA.facility_id,
    lifecycle_state: "DRAFT",
    payload_checksum: "sha256:test-attendance-draft",
    scope_kind: "TRAINING_SCOPED",
    created_at: "2026-08-22T16:00:00.000Z",
    submitted_at: null,
    updated_at: "2026-08-22T16:00:00.000Z"
  };
}

function trainingEvidenceRecord(
  enrollment: TrainingEnrollment,
  overrides: Partial<TrainingEvidenceWorkspaceRecord["evidence"]> = {}
): TrainingEvidenceWorkspaceRecord {
  return {
    evidence: {
      evidence_record_id: overrides.evidence_record_id ?? skillsDraftId,
      template_code:
        overrides.template_code ?? "OGI_F023_OPERATIONAL_SKILLS_ASSESSMENT",
      template_name: overrides.template_name ?? "Operational Skills Assessment",
      document_number: overrides.document_number ?? "OGI F-023",
      lifecycle_state: overrides.lifecycle_state ?? "DRAFT",
      client_id: overrides.client_id ?? enrollment.client_id,
      facility_id:
        overrides.facility_id ??
        enrollment.training_session?.facility_id ??
        null,
      training_enrollment_id: enrollment.id,
      training_session_id: enrollment.training_session_id,
      submitted_at: overrides.submitted_at ?? null,
      created_at: overrides.created_at ?? "2026-08-18T05:00:00.000Z",
      updated_at: overrides.updated_at ?? "2026-08-18T05:00:00.000Z"
    },
    evidence_link: null,
    assessment_result: null,
    readiness_decision: null
  };
}

function trainingEvidenceSlot(
  slot: TrainingEvidenceWorkspaceSlot["slot"],
  enrollment: TrainingEnrollment,
  overrides: Partial<TrainingEvidenceWorkspaceSlot> = {}
): TrainingEvidenceWorkspaceSlot {
  const slotMetadata = {
    SKILLS: {
      evidence_purpose: "SKILLS_ASSESSMENT" as const,
      template_code: "OGI_F023_OPERATIONAL_SKILLS_ASSESSMENT" as const,
      document_number: "OGI F-023" as const
    },
    KNOWLEDGE: {
      evidence_purpose: "KNOWLEDGE_ASSESSMENT" as const,
      template_code: "OGI_F024_OPERATIONAL_KNOWLEDGE_ASSESSMENT_RECORD" as const,
      document_number: "OGI F-024" as const
    },
    READINESS: {
      evidence_purpose: "READINESS" as const,
      template_code: "OGI_F025_OPERATIONAL_READINESS_EVALUATION" as const,
      document_number: "OGI F-025" as const
    }
  }[slot];

  return {
    slot,
    ...slotMetadata,
    active_draft: null,
    history: [],
    can_create_draft: true,
    ...overrides
  };
}

function trainingEvidenceWorkspace(
  enrollment: TrainingEnrollment,
  slots: readonly TrainingEvidenceWorkspaceSlot[] = [
    trainingEvidenceSlot("SKILLS", enrollment),
    trainingEvidenceSlot("KNOWLEDGE", enrollment),
    trainingEvidenceSlot("READINESS", enrollment)
  ]
): TrainingEvidenceWorkspace {
  return {
    enrollment,
    slots
  };
}

function workspaceRoute(
  enrollment: TrainingEnrollment,
  workspaces: readonly TrainingEvidenceWorkspace[] = [
    trainingEvidenceWorkspace(enrollment)
  ]
): MockRoute {
  return {
    url: `/api/v1/training/enrollments/${enrollment.id}/evidence-workspace`,
    responses: workspaces.map((workspace) => ({ status: 200, body: workspace }))
  };
}

function runtimeTemplateRoute(templateCode: string, templateVersionId: string): MockRoute {
  return {
    url: `/api/v1/operational-evidence/template-versions/${templateVersionId}`,
    responses: [
      {
        status: 200,
        body: {
          template_registry_id: `registry-${templateCode}`,
          template_version_id: templateVersionId,
          template_code: templateCode,
          template_archetype: "CHECKLIST_INSPECTION",
          template_version: "1.0",
          schema_version: "1.0",
          checksum: `checksum-${templateVersionId}`,
          status: "ACTIVE",
          definition_jsonb: oetsDefinition(templateCode)
        }
      }
    ]
  };
}

function operationalEvidenceRecordRoute(
  record: ReturnType<typeof operationalEvidenceRecordResponse>
): MockRoute {
  return {
    url: `/api/v1/operational-evidence/records/${record.id}`,
    responses: [{ status: 200, body: record }]
  };
}

function operationalEvidenceRecordResponse({
  enrollment,
  evidenceRecordId,
  templateCode,
  templateVersionId,
  lifecycleState = "DRAFT",
  createdByUserId = baseSession.id
}: {
  enrollment: TrainingEnrollment;
  evidenceRecordId: string;
  templateCode: string;
  templateVersionId: string;
  lifecycleState?: string;
  createdByUserId?: string;
}) {
  const submittedAt =
    lifecycleState === "DRAFT" ? "2026-08-18T05:00:00.000Z" : "2026-08-18T06:00:00.000Z";
  const assessmentNumber =
    templateCode === "OGI_F023_OPERATIONAL_SKILLS_ASSESSMENT"
      ? "OGI-OSA-2026-0001"
      : templateCode === "OGI_F024_OPERATIONAL_KNOWLEDGE_ASSESSMENT_RECORD"
        ? "OGI-OKA-2026-0001"
        : null;

  return {
    id: evidenceRecordId,
    template_provenance: {
      template_id: `template-${templateCode}`,
      template_code: templateCode,
      template_version: "1.0",
      template_registry_id: `registry-${templateCode}`,
      template_version_id: templateVersionId,
      schema_version: "1.0",
      checksum: `checksum-${templateVersionId}`
    },
    client_id: enrollment.client_id,
    facility_id: enrollment.training_session?.facility_id ?? null,
    lifecycle_state: lifecycleState,
    payload: {
      sections: {
        ...(assessmentNumber
          ? {
              ASSESSMENT_INFORMATION: {
                ASSESSMENT_NUMBER: assessmentNumber
              }
            }
          : {}),
        GENERAL_EVIDENCE: {
          TEXT_FIELD: "Contextual training evidence"
        }
      }
    },
    payload_checksum: "sha256:contextual-training-evidence",
    scope_kind: "TRAINING_SCOPED",
    training_context: {
      id: `context-${evidenceRecordId}`,
      operational_evidence_record_id: evidenceRecordId,
      training_enrollment_id: enrollment.id,
      training_session_id: enrollment.training_session_id,
      created_by_user_id: createdByUserId,
      created_at: "2026-08-18T05:00:00.000Z",
      enrollment: {
        id: enrollment.id,
        program_code: enrollment.program_code,
        client_id: enrollment.client_id,
        training_session_id: enrollment.training_session_id,
        trainee: enrollment.trainee,
        client: enrollment.client,
        training_session: enrollment.training_session
          ? {
              ...enrollment.training_session,
              facility: null
            }
          : null
      }
    },
    created_by_user_id: createdByUserId,
    submitted_by_user_id: createdByUserId,
    created_at: "2026-08-18T05:00:00.000Z",
    submitted_at: submittedAt,
    updated_at: "2026-08-18T05:00:00.000Z"
  };
}

function oetsDefinition(templateCode: string) {
  const assessmentNumberField =
    templateCode === "OGI_F023_OPERATIONAL_SKILLS_ASSESSMENT" ||
    templateCode === "OGI_F024_OPERATIONAL_KNOWLEDGE_ASSESSMENT_RECORD"
      ? [
          {
            field_id: `field-assessment-number-${templateCode}`,
            field_code: "ASSESSMENT_NUMBER",
            label: "Assessment Number",
            field_type: "TEXT",
            required: false,
            readonly: false,
            visible: true,
            sequence: 1
          }
        ]
      : [];

  return {
    schema_version: "1.0",
    template_metadata: {
      template_id: `template-${templateCode}`,
      template_code: templateCode,
      template_name: trainingTemplateName(templateCode),
      module: "TRAINING",
      version: "1.0"
    },
    sections: [
      ...(assessmentNumberField.length > 0
        ? [
            {
              section_id: "section-assessment-information",
              section_code: "ASSESSMENT_INFORMATION",
              title: "Assessment Information",
              sequence: 1,
              repeatable: false,
              visible: true,
              fields: assessmentNumberField
            }
          ]
        : []),
      {
        section_id: "section-general-evidence",
        section_code: "GENERAL_EVIDENCE",
        title: "General Evidence",
        sequence: assessmentNumberField.length > 0 ? 2 : 1,
        repeatable: false,
        visible: true,
        fields: [
          {
            field_id: "field-text",
            field_code: "TEXT_FIELD",
            label: "Text Field",
            field_type: "TEXT",
            required: false,
            readonly: false,
            visible: true,
            sequence: 1
          }
        ]
      }
    ]
  };
}

function trainingTemplateName(templateCode: string) {
  switch (templateCode) {
    case "OGI_F023_OPERATIONAL_SKILLS_ASSESSMENT":
      return "Operational Skills Assessment";
    case "OGI_F024_OPERATIONAL_KNOWLEDGE_ASSESSMENT_RECORD":
      return "Operational Knowledge Assessment Record";
    case "OGI_F025_OPERATIONAL_READINESS_EVALUATION":
      return "Operational Readiness Evaluation";
    default:
      return "Training Evidence";
  }
}

interface MockResponse {
  status: number;
  body?: unknown;
  statusText?: string;
}

interface MockRoute {
  method?: string;
  url: string;
  responses: MockResponse[];
}

function renderWithRoute(initialPath: string) {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [initialPath]
  });

  return {
    router,
    ...render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    )
  };
}

function mockFetchRoutes(routesToMock: MockRoute[]) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = readRequestPath(input);
    const method = init?.method ?? "GET";
    const route = routesToMock.find(
      (candidate) => candidate.url === url && (candidate.method ?? "GET") === method
    );

    calls.push({ url, init });

    if (!route) {
      throw new Error(`Unexpected fetch call: ${method} ${url}`);
    }

    const next = route.responses.shift();

    if (!next) {
      throw new Error(`Unexpected fetch call count: ${method} ${url}`);
    }

    return new Response(
      next.body === undefined ? null : JSON.stringify(next.body),
      {
        status: next.status,
        statusText: next.statusText,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  });

  vi.stubGlobal("fetch", fetchMock);

  return { calls };
}

function readRequestPath(input: RequestInfo | URL) {
  const value = String(input);

  if (!value.startsWith("http")) {
    return value;
  }

  const url = new URL(value);

  return `${url.pathname}${url.search}`;
}

function authRoutes(session = baseSession): MockRoute[] {
  return [
    {
      method: "POST",
      url: "/api/v1/auth/refresh",
      responses: [{ status: 200, body: { accessToken: "access-token" } }]
    },
    {
      method: "GET",
      url: "/api/v1/auth/me",
      responses: [{ status: 200, body: session }]
    }
  ];
}

function standardRoutes(overrides: MockRoute[] = []): MockRoute[] {
  return [
    ...authRoutes(),
    ...overrides,
    {
      url: "/api/v1/training/trainees",
      responses: [{ status: 200, body: { trainees: [traineeA, traineeB] } }]
    },
    {
      url: `/api/v1/training/trainees/${traineeAId}`,
      responses: [{ status: 200, body: traineeA }]
    },
    {
      url: `/api/v1/training/trainees/${traineeAId}/enrollments`,
      responses: [{ status: 200, body: { enrollments: [enrollmentA] } }]
    },
    workspaceRoute(enrollmentA)
  ];
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.sessionStorage.setItem(getRefreshTokenStorageKey(), "refresh-token");
});

afterEach(() => {
  cleanup();
  configureApiAuth(null);
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
});

describe("Registration Training frontend", () => {
  it("adds permission-gated Training navigation and loads the route", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes(standardRoutes());

    renderWithRoute(routes.workbench);

    await user.click(await screen.findByRole("button", { name: "Menu" }));
    await user.click(screen.getByRole("link", { name: "Registration" }));
    await user.click(await screen.findByRole("link", { name: "Training" }));

    expect(
      await screen.findByRole("heading", { name: "Training" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Training" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: "Clients" })).toHaveAttribute(
      "href",
      routes.registrationClients
    );
    expect(screen.getByRole("link", { name: "Facilities" })).toHaveAttribute(
      "href",
      routes.registrationFacilities
    );
    expect(screen.getByRole("link", { name: "Personnel" })).toHaveAttribute(
      "href",
      routes.registrationPersonnel
    );
    expect(calls.map(({ url }) => url)).toContain("/api/v1/auth/refresh");
    expect(calls.map(({ url }) => url)).toContain("/api/v1/auth/me");
    expect(calls.map(({ url }) => url)).toContain("/api/v1/training/trainees");
  });

  it("hides Training navigation without view_training and does not call Training endpoints", async () => {
    const { calls } = mockFetchRoutes(
      authRoutes({
        ...baseSession,
        permissions: ["view_client"]
      })
    );

    renderWithRoute(routes.registrationTraining);

    expect(
      await screen.findByText(
        "Your current session does not include Training registration authority."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Training" })).not.toBeInTheDocument();
    expect(calls.map(({ url }) => url)).toEqual([
      "/api/v1/auth/refresh",
      "/api/v1/auth/me"
    ]);
  });

  it("renders Trainee list and detail with human identity before technical metadata", async () => {
    mockFetchRoutes(standardRoutes());

    renderWithRoute(routes.registrationTraining);

    expect(await screen.findByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getAllByText("John Santos").length).toBeGreaterThan(0);
    expect(screen.getByText("Student number pending")).toBeInTheDocument();
    expect(screen.getByText("OGI-STU-2026-0002")).toBeInTheDocument();

    const traineeList = screen.getByRole("list", { name: "Trainee records" });
    expect(within(traineeList).queryByText(traineeAId)).not.toBeInTheDocument();
    expect(await screen.findByText("Student number: Pending")).toBeInTheDocument();
    expect(screen.getAllByText("jane.smith@example.test").length).toBeGreaterThan(0);
    expect(screen.getByText("External trainee")).toBeInTheDocument();
  });

  it("creates a Trainee with the exact backend contract and selects the new Trainee", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...authRoutes(),
      {
        url: "/api/v1/training/trainees",
        responses: [
          { status: 200, body: { trainees: [traineeA] } },
          { status: 200, body: { trainees: [traineeA, createdTrainee] } }
        ]
      },
      {
        url: `/api/v1/training/trainees/${traineeAId}`,
        responses: [{ status: 200, body: traineeA }]
      },
      {
        url: `/api/v1/training/trainees/${traineeAId}/enrollments`,
        responses: [{ status: 200, body: { enrollments: [] } }]
      },
      {
        method: "POST",
        url: "/api/v1/training/trainees",
        responses: [{ status: 201, body: createdTrainee }]
      },
      {
        url: `/api/v1/training/trainees/${createdTrainee.id}/enrollments`,
        responses: [{ status: 200, body: { enrollments: [] } }]
      }
    ]);

    renderWithRoute(routes.registrationTraining);

    await user.click(await screen.findByRole("button", { name: "Register Trainee" }));
    expect(screen.queryByLabelText(/Student Number/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Client$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/StaffMember/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Full name"), "New Trainee");
    await user.type(screen.getByLabelText("Email"), "new.trainee@example.test");
    await user.click(screen.getByRole("button", { name: "Create Trainee" }));

    await screen.findByText("Trainee registered successfully.");
    expect((await screen.findAllByText("New Trainee")).length).toBeGreaterThan(0);

    const createCall = calls.find(
      (call) => call.url === "/api/v1/training/trainees" && call.init?.method === "POST"
    );

    expect(JSON.parse(String(createCall?.init?.body))).toEqual({
      full_name: "New Trainee",
      email: "new.trainee@example.test",
      phone_number: null,
      notes: null
    });
  });

  it("cancels Trainee creation without mutation", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes(standardRoutes());

    renderWithRoute(routes.registrationTraining);

    await user.click(await screen.findByRole("button", { name: "Register Trainee" }));
    await user.type(screen.getByLabelText("Full name"), "Cancelled Trainee");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("form", { name: "Create Trainee" })).not.toBeInTheDocument();
    expect(screen.getByText("Student number: Pending")).toBeInTheDocument();
    expect(
      calls.some(
        (call) =>
          call.url === "/api/v1/training/trainees" && call.init?.method === "POST"
      )
    ).toBe(false);
  });

  it("links Personnel by selected staff_member_id without manual UUID or name matching", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...authRoutes(),
      {
        url: "/api/v1/training/trainees",
        responses: [{ status: 200, body: { trainees: [traineeA] } }]
      },
      {
        url: `/api/v1/training/trainees/${traineeAId}`,
        responses: [
          { status: 200, body: traineeA },
          { status: 200, body: linkedTraineeA }
        ]
      },
      {
        url: `/api/v1/training/trainees/${traineeAId}/enrollments`,
        responses: [{ status: 200, body: { enrollments: [] } }]
      },
      {
        url: "/api/v1/registration/personnel",
        responses: [{ status: 200, body: { personnel: [staffA, staffB] } }]
      },
      {
        method: "POST",
        url: `/api/v1/training/trainees/${traineeAId}/staff-member-links`,
        responses: [{ status: 201, body: linkedTraineeA.staff_member_links[0] }]
      }
    ]);

    renderWithRoute(routes.registrationTraining);

    await user.click(await screen.findByRole("button", { name: "Link Personnel" }));
    expect(screen.queryByLabelText(/uuid/i)).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Ana Santos/ })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Personnel record"), staffAId);
    await user.click(screen.getByRole("button", { name: "Save Personnel Link" }));

    await screen.findByText("Linked Personnel record successfully.");
    expect(await screen.findByText("Linked Personnel record")).toBeInTheDocument();
    expect(screen.getByText("Ana Santos")).toBeInTheDocument();

    const linkCall = calls.find((call) =>
      call.url.endsWith("/staff-member-links")
    );

    expect(JSON.parse(String(linkCall?.init?.body))).toEqual({
      staff_member_id: staffAId
    });
    expect(
      calls.some((call) => call.url.includes("facility-assignments"))
    ).toBe(false);
    expect(
      calls.some((call) => call.url.includes("user-facility-access"))
    ).toBe(false);
  });

  it("renders Enrollment list and creates Enrollment with program_code and optional client_id", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...authRoutes(),
      {
        url: "/api/v1/training/trainees",
        responses: [{ status: 200, body: { trainees: [traineeA] } }]
      },
      {
        url: `/api/v1/training/trainees/${traineeAId}`,
        responses: [{ status: 200, body: traineeA }]
      },
      {
        url: `/api/v1/training/trainees/${traineeAId}/enrollments`,
        responses: [
          { status: 200, body: { enrollments: [enrollmentA] } },
          { status: 200, body: { enrollments: [enrollmentA] } }
        ]
      },
      workspaceRoute(enrollmentA),
      {
        url: "/api/v1/registration/clients",
        responses: [{ status: 200, body: { clients: [clientA, clientB] } }]
      },
      {
        url: "/api/v1/training/sessions",
        responses: [{ status: 200, body: { sessions: [trainingSessionA] } }]
      },
      {
        method: "POST",
        url: `/api/v1/training/trainees/${traineeAId}/enrollments`,
        responses: [{ status: 201, body: assignedEnrollmentA }]
      }
    ]);

    renderWithRoute(routes.registrationTraining);

    expect(await screen.findByText("L3 - Open Water Guardian")).toBeInTheDocument();
    expect(screen.getAllByText("Ocean Guard International").length).toBeGreaterThan(0);
    expect(screen.queryByText(/pass/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/fail/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/certification eligibility/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add Enrollment" }));
    expect(screen.getByRole("option", { name: "L7 - Master Guardian Instructor" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Client UUID/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Session UUID/i)).not.toBeInTheDocument();
    expect(
      screen.getByLabelText("Training Session (optional)")
    ).toBeInTheDocument();
    expect(screen.queryByText(trainingSessionAId)).not.toBeInTheDocument();
    expect(
      screen.getByRole("option", {
        name: /Open Water Guardian Cohort A.*Braven Burrows.*Makati Training Pool/
      })
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Program"), "MASTER_GUARDIAN_INSTRUCTOR");
    await user.selectOptions(screen.getByLabelText("Sponsoring Client (optional)"), clientBId);
    await user.selectOptions(
      screen.getByLabelText("Training Session (optional)"),
      trainingSessionAId
    );
    await user.click(screen.getByRole("button", { name: "Save Enrollment" }));

    await screen.findByText("Training enrollment added successfully.");

    const enrollmentCall = calls.find(
      (call) =>
        call.url.endsWith("/enrollments") && call.init?.method === "POST"
    );

    expect(JSON.parse(String(enrollmentCall?.init?.body))).toEqual({
      program_code: "MASTER_GUARDIAN_INSTRUCTOR",
      client_id: clientBId,
      training_session_id: trainingSessionAId,
      notes: null
    });
    expect(calls.filter((call) => call.url.endsWith("/enrollments"))).toHaveLength(3);
    expect(calls.some((call) => call.url.includes("certifications"))).toBe(false);
    expect(calls.some((call) => call.url.includes("operational-evidence"))).toBe(false);
  });

  it("allows independent Enrollment with no Sponsoring Client and shows the empty state", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...authRoutes(),
      {
        url: "/api/v1/training/trainees",
        responses: [{ status: 200, body: { trainees: [traineeA] } }]
      },
      {
        url: `/api/v1/training/trainees/${traineeAId}`,
        responses: [{ status: 200, body: traineeA }]
      },
      {
        url: `/api/v1/training/trainees/${traineeAId}/enrollments`,
        responses: [
          { status: 200, body: { enrollments: [] } },
          { status: 200, body: { enrollments: [] } }
        ]
      },
      {
        url: "/api/v1/registration/clients",
        responses: [{ status: 200, body: { clients: [clientA] } }]
      },
      {
        url: "/api/v1/training/sessions",
        responses: [{ status: 200, body: { sessions: [trainingSessionA] } }]
      },
      {
        method: "POST",
        url: `/api/v1/training/trainees/${traineeAId}/enrollments`,
        responses: [{ status: 201, body: { ...enrollmentA, client_id: null, client: null } }]
      }
    ]);

    renderWithRoute(routes.registrationTraining);

    expect(
      await screen.findByText("No training enrollments recorded.")
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add Enrollment" }));
    await user.selectOptions(screen.getByLabelText("Program"), "GUARDIAN_RESPONDER");
    await user.click(screen.getByRole("button", { name: "Save Enrollment" }));

    const enrollmentCall = calls.find(
      (call) =>
        call.url.endsWith("/enrollments") && call.init?.method === "POST"
    );

    expect(JSON.parse(String(enrollmentCall?.init?.body))).toEqual({
      program_code: "GUARDIAN_RESPONDER",
      client_id: null,
      training_session_id: null,
      notes: null
    });
  });

  it("renders independent Training Evidence context without client or facility selectors", async () => {
    mockFetchRoutes([
      ...authRoutes(),
      {
        url: "/api/v1/training/trainees",
        responses: [{ status: 200, body: { trainees: [traineeB] } }]
      },
      {
        url: `/api/v1/training/trainees/${traineeBId}`,
        responses: [{ status: 200, body: traineeB }]
      },
      {
        url: `/api/v1/training/trainees/${traineeBId}/enrollments`,
        responses: [{ status: 200, body: { enrollments: [independentEnrollmentB] } }]
      },
      workspaceRoute(independentEnrollmentB)
    ]);

    renderWithRoute(routes.registrationTraining);

    expect(await screen.findByText("Skills, Knowledge, and Readiness")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Skills Assessment" })).toBeInTheDocument();
    expect(screen.getAllByText("John Santos").length).toBeGreaterThan(0);
    expect(screen.getAllByText("OGI-STU-2026-0002").length).toBeGreaterThan(0);
    expect(screen.getAllByText("L1 - Guardian Responder").length).toBeGreaterThan(0);
    expect(screen.getByText("OGI Direct / Independent")).toBeInTheDocument();
    expect(screen.getByText("No Training Session assigned")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Create Draft" })).toHaveLength(3);
    expect(screen.getByText("Template: OGI F-023")).toBeInTheDocument();
    expect(screen.getByText("Template: OGI F-024")).toBeInTheDocument();
    expect(screen.getByText("Template: OGI F-025")).toBeInTheDocument();
    expect(screen.getByText("F-022 Session Roster")).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Client$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Facility$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/StaffMember/i)).not.toBeInTheDocument();
  });

  it("creates Training-scoped F-023, F-024, and F-025 drafts with only the template_code contract", async () => {
    const user = userEvent.setup();
    const draftRequests = [
      {
        title: "Skills Assessment",
        evidenceRecordId: skillsDraftId,
        templateCode: "OGI_F023_OPERATIONAL_SKILLS_ASSESSMENT"
      },
      {
        title: "Knowledge Assessment",
        evidenceRecordId: knowledgeRecordId,
        templateCode: "OGI_F024_OPERATIONAL_KNOWLEDGE_ASSESSMENT_RECORD"
      },
      {
        title: "Readiness Evaluation",
        evidenceRecordId: readinessRecordId,
        templateCode: "OGI_F025_OPERATIONAL_READINESS_EVALUATION"
      }
    ] as const;
    const { calls } = mockFetchRoutes([
      ...authRoutes(),
      {
        url: "/api/v1/training/trainees",
        responses: [{ status: 200, body: { trainees: [traineeB] } }]
      },
      {
        url: `/api/v1/training/trainees/${traineeBId}`,
        responses: [{ status: 200, body: traineeB }]
      },
      {
        url: `/api/v1/training/trainees/${traineeBId}/enrollments`,
        responses: [{ status: 200, body: { enrollments: [independentEnrollmentB] } }]
      },
      workspaceRoute(independentEnrollmentB, [
        trainingEvidenceWorkspace(independentEnrollmentB),
        trainingEvidenceWorkspace(independentEnrollmentB),
        trainingEvidenceWorkspace(independentEnrollmentB),
        trainingEvidenceWorkspace(independentEnrollmentB)
      ]),
      {
        method: "POST",
        url: `/api/v1/training/enrollments/${independentEnrollmentB.id}/evidence-drafts`,
        responses: draftRequests.map((request) => ({
          status: 201,
          body: {
            evidence_record_id: request.evidenceRecordId,
            template_code: request.templateCode,
            template_version_id: `template-version-${request.evidenceRecordId}`,
            template_version: "1.0",
            schema_version: "1.0",
            client_id: null,
            facility_id: null,
            lifecycle_state: "DRAFT",
            payload_checksum: "sha256:test",
            scope_kind: "TRAINING_SCOPED",
            created_at: "2026-08-18T05:00:00.000Z",
            submitted_at: null,
            updated_at: "2026-08-18T05:00:00.000Z"
          }
        }))
      }
    ]);

    const { router } = renderWithRoute(routes.registrationTraining);

    const request = draftRequests[0];
    const slotHeading = await screen.findByRole("heading", {
      name: request.title
    });
    await user.click(
      within(slotHeading.closest("article") as HTMLElement).getByRole("button", {
        name: "Create Draft"
      })
    );

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        routes.evidenceRecordPath(request.evidenceRecordId)
      )
    );

    const draftCalls = calls.filter((call) => call.url.endsWith("/evidence-drafts"));

    expect(draftCalls.map((call) => JSON.parse(String(call.init?.body)))).toEqual([
      { template_code: request.templateCode }
    ]);
    expect(draftCalls.map((call) => String(call.init?.body)).join("\n")).not.toContain(
      "client_id"
    );
    expect(draftCalls.map((call) => String(call.init?.body)).join("\n")).not.toContain(
      "facility_id"
    );
    expect(draftCalls.map((call) => String(call.init?.body)).join("\n")).not.toContain(
      "staff_member"
    );
    expect(draftCalls.map((call) => String(call.init?.body)).join("\n")).not.toContain(
      "assessment"
    );
  });

  const contextualDraftCases = [
    {
      title: "Skills Assessment",
      evidenceRecordId: skillsDraftId,
      templateCode: "OGI_F023_OPERATIONAL_SKILLS_ASSESSMENT",
      templateVersionId: "template-version-skills"
    },
    {
      title: "Knowledge Assessment",
      evidenceRecordId: knowledgeRecordId,
      templateCode: "OGI_F024_OPERATIONAL_KNOWLEDGE_ASSESSMENT_RECORD",
      templateVersionId: "template-version-knowledge"
    },
    {
      title: "Readiness Evaluation",
      evidenceRecordId: readinessRecordId,
      templateCode: "OGI_F025_OPERATIONAL_READINESS_EVALUATION",
      templateVersionId: "template-version-readiness"
    }
  ] as const;

  it.each(contextualDraftCases)(
    "opens newly-created Training-scoped $title DRAFT as editable for the current Training actor",
    async ({ evidenceRecordId, templateCode, templateVersionId, title }) => {
      const user = userEvent.setup();
      const trainingDraftSession: AuthenticatedSession = {
        ...baseSession,
        permissions: baseSession.permissions.filter(
          (permission) => permission !== "submit_operational_evidence"
        )
      };
      const draftRecord = operationalEvidenceRecordResponse({
        enrollment: independentEnrollmentB,
        evidenceRecordId,
        templateCode,
        templateVersionId
      });

      mockFetchRoutes([
        ...authRoutes(trainingDraftSession),
        {
          url: "/api/v1/training/trainees",
          responses: [{ status: 200, body: { trainees: [traineeB] } }]
        },
        {
          url: `/api/v1/training/trainees/${traineeBId}`,
          responses: [{ status: 200, body: traineeB }]
        },
        {
          url: `/api/v1/training/trainees/${traineeBId}/enrollments`,
          responses: [{ status: 200, body: { enrollments: [independentEnrollmentB] } }]
        },
        workspaceRoute(independentEnrollmentB),
        {
          method: "POST",
          url: `/api/v1/training/enrollments/${independentEnrollmentB.id}/evidence-drafts`,
          responses: [
            {
              status: 201,
              body: {
                evidence_record_id: evidenceRecordId,
                template_code: templateCode,
                template_version_id: templateVersionId,
                template_version: "1.0",
                schema_version: "1.0",
                client_id: null,
                facility_id: null,
                lifecycle_state: "DRAFT",
                payload_checksum: "sha256:test",
                scope_kind: "TRAINING_SCOPED",
                created_at: "2026-08-18T05:00:00.000Z",
                submitted_at: null,
                updated_at: "2026-08-18T05:00:00.000Z"
              }
            }
          ]
        },
        operationalEvidenceRecordRoute(draftRecord),
        runtimeTemplateRoute(templateCode, templateVersionId)
      ]);

      const { router } = renderWithRoute(routes.registrationTraining);

      const slotHeading = await screen.findByRole("heading", { name: title });
      await user.click(
        within(slotHeading.closest("article") as HTMLElement).getByRole("button", {
          name: "Create Draft"
        })
      );

      await waitFor(() =>
        expect(router.state.location.pathname).toBe(
          routes.evidenceRecordPath(evidenceRecordId)
        )
      );
      expect(await screen.findByRole("heading", { name: "Draft Evidence" })).toBeInTheDocument();
      expect(screen.queryByText("Read only")).not.toBeInTheDocument();
      expect(screen.getByText("Training Context")).toBeInTheDocument();
      expect(screen.getAllByText("John Santos").length).toBeGreaterThan(0);
      expect(screen.getAllByText("OGI-STU-2026-0002").length).toBeGreaterThan(0);
      if (templateCode === "OGI_F023_OPERATIONAL_SKILLS_ASSESSMENT") {
        expect(screen.getByLabelText("Assessment Number")).toHaveValue(
          "OGI-OSA-2026-0001"
        );
        expect(screen.getByLabelText("Assessment Number")).toBeDisabled();
      } else if (
        templateCode === "OGI_F024_OPERATIONAL_KNOWLEDGE_ASSESSMENT_RECORD"
      ) {
        expect(screen.getByLabelText("Assessment Number")).toHaveValue(
          "OGI-OKA-2026-0001"
        );
        expect(screen.getByLabelText("Assessment Number")).toBeDisabled();
      } else {
        expect(screen.queryByLabelText("Assessment Number")).not.toBeInTheDocument();
      }
      expect(screen.getByLabelText("Text Field")).not.toBeDisabled();
    }
  );

  it("opens an active Training-scoped DRAFT from Open Draft as editable for the current Training actor", async () => {
    const user = userEvent.setup();
    const trainingDraftSession: AuthenticatedSession = {
      ...baseSession,
      permissions: baseSession.permissions.filter(
        (permission) => permission !== "submit_operational_evidence"
      )
    };
    const activeDraft = trainingEvidenceRecord(independentEnrollmentB);
    const draftRecord = operationalEvidenceRecordResponse({
      enrollment: independentEnrollmentB,
      evidenceRecordId: skillsDraftId,
      templateCode: "OGI_F023_OPERATIONAL_SKILLS_ASSESSMENT",
      templateVersionId: "template-version-skills"
    });

    mockFetchRoutes([
      ...authRoutes(trainingDraftSession),
      {
        url: "/api/v1/training/trainees",
        responses: [{ status: 200, body: { trainees: [traineeB] } }]
      },
      {
        url: `/api/v1/training/trainees/${traineeBId}`,
        responses: [{ status: 200, body: traineeB }]
      },
      {
        url: `/api/v1/training/trainees/${traineeBId}/enrollments`,
        responses: [{ status: 200, body: { enrollments: [independentEnrollmentB] } }]
      },
      workspaceRoute(independentEnrollmentB, [
        trainingEvidenceWorkspace(independentEnrollmentB, [
          trainingEvidenceSlot("SKILLS", independentEnrollmentB, {
            active_draft: activeDraft,
            history: [activeDraft],
            can_create_draft: false
          }),
          trainingEvidenceSlot("KNOWLEDGE", independentEnrollmentB),
          trainingEvidenceSlot("READINESS", independentEnrollmentB)
        ])
      ]),
      operationalEvidenceRecordRoute(draftRecord),
      runtimeTemplateRoute("OGI_F023_OPERATIONAL_SKILLS_ASSESSMENT", "template-version-skills")
    ]);

    const { router } = renderWithRoute(routes.registrationTraining);

    await user.click((await screen.findAllByRole("link", { name: "Open Draft" }))[0]);

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(routes.evidenceRecordPath(skillsDraftId))
    );
    expect(await screen.findByRole("heading", { name: "Draft Evidence" })).toBeInTheDocument();
    expect(screen.queryByText("Read only")).not.toBeInTheDocument();
    expect(screen.getByText("Training Context")).toBeInTheDocument();
    expect(screen.getByLabelText("Text Field")).not.toBeDisabled();
  });

  it.each([
    ["SUBMITTED", "Submitted Evidence"],
    ["GOVERNANCE_APPROVED", "Submitted Evidence"]
  ] as const)(
    "keeps Training-scoped %s evidence immutable",
    async (lifecycleState, heading) => {
      const record = operationalEvidenceRecordResponse({
        enrollment: independentEnrollmentB,
        evidenceRecordId: skillsDraftId,
        templateCode: "OGI_F023_OPERATIONAL_SKILLS_ASSESSMENT",
        templateVersionId: "template-version-skills",
        lifecycleState
      });

      mockFetchRoutes([
        ...authRoutes(baseSession),
        operationalEvidenceRecordRoute(record),
        runtimeTemplateRoute("OGI_F023_OPERATIONAL_SKILLS_ASSESSMENT", "template-version-skills")
      ]);

      renderWithRoute(routes.evidenceRecordPath(skillsDraftId));

      expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
      expect(screen.getByText("Read only")).toBeInTheDocument();
      expect(screen.getByText("Training Context")).toBeInTheDocument();
      expect(screen.getByLabelText("Text Field")).toBeDisabled();
      expect(screen.queryByRole("button", { name: "Save Draft" })).not.toBeInTheDocument();
    }
  );

  it("does not make another actor's Training-scoped DRAFT editable without draft authority", async () => {
    const unauthorizedSession: AuthenticatedSession = {
      ...baseSession,
      permissions: ["view_training"]
    };
    const record = operationalEvidenceRecordResponse({
      enrollment: independentEnrollmentB,
      evidenceRecordId: skillsDraftId,
      templateCode: "OGI_F023_OPERATIONAL_SKILLS_ASSESSMENT",
      templateVersionId: "template-version-skills",
      createdByUserId: "00000000-0000-4000-8000-000000000099"
    });

    mockFetchRoutes([
      ...authRoutes(unauthorizedSession),
      operationalEvidenceRecordRoute(record),
      runtimeTemplateRoute("OGI_F023_OPERATIONAL_SKILLS_ASSESSMENT", "template-version-skills")
    ]);

    renderWithRoute(routes.evidenceRecordPath(skillsDraftId));

    expect(await screen.findByRole("heading", { name: "Draft Evidence" })).toBeInTheDocument();
    expect(screen.getByText("Read only")).toBeInTheDocument();
    expect(screen.getByText("Training Context")).toBeInTheDocument();
    expect(screen.getByLabelText("Text Field")).toBeDisabled();
  });

  it("renders active drafts, linked history, and assessment/readiness summaries", async () => {
    const skillsRecord = trainingEvidenceRecord(assignedEnrollmentA, {
      evidence_record_id: skillsDraftId,
      template_code: "OGI_F023_OPERATIONAL_SKILLS_ASSESSMENT",
      template_name: "Operational Skills Assessment",
      document_number: "OGI F-023",
      lifecycle_state: "DRAFT"
    });
    const knowledgeRecord: TrainingEvidenceWorkspaceRecord = {
      ...trainingEvidenceRecord(assignedEnrollmentA, {
        evidence_record_id: knowledgeRecordId,
        template_code: "OGI_F024_OPERATIONAL_KNOWLEDGE_ASSESSMENT_RECORD",
        template_name: "Operational Knowledge Assessment Record",
        document_number: "OGI F-024",
        lifecycle_state: "SUBMITTED",
        submitted_at: "2026-08-18T06:00:00.000Z"
      }),
      evidence_link: {
        id: "00000000-0000-4000-8000-000000890001",
        training_enrollment_id: assignedEnrollmentA.id,
        operational_evidence_record_id: knowledgeRecordId,
        evidence_purpose: "KNOWLEDGE_ASSESSMENT",
        created_by_user_id: null,
        linked_at: "2026-08-18T06:30:00.000Z",
        evidence: {
          evidence_record_id: knowledgeRecordId,
          template_code: "OGI_F024_OPERATIONAL_KNOWLEDGE_ASSESSMENT_RECORD",
          template_name: "Operational Knowledge Assessment Record",
          document_number: "OGI F-024",
          lifecycle_state: "SUBMITTED",
          client_id: clientAId,
          facility_id: trainingSessionA.facility_id,
          submitted_at: "2026-08-18T06:00:00.000Z",
          created_at: "2026-08-18T05:30:00.000Z"
        }
      },
      assessment_result: {
        id: "00000000-0000-4000-8000-0000008a0001",
        assessment_type: "KNOWLEDGE",
        result_status: "COMPETENT",
        score: 92,
        remediation_required: false,
        reassessment_required: false,
        recorded_at: "2026-08-18T07:00:00.000Z",
        recorded_by_user_id: null,
        evidence_link_id: "00000000-0000-4000-8000-000000890001"
      }
    };
    const readinessRecord: TrainingEvidenceWorkspaceRecord = {
      ...trainingEvidenceRecord(assignedEnrollmentA, {
        evidence_record_id: readinessRecordId,
        template_code: "OGI_F025_OPERATIONAL_READINESS_EVALUATION",
        template_name: "Operational Readiness Evaluation",
        document_number: "OGI F-025",
        lifecycle_state: "SUBMITTED",
        submitted_at: "2026-08-18T08:00:00.000Z"
      }),
      readiness_decision: {
        id: "00000000-0000-4000-8000-0000008b0001",
        readiness_outcome: "READY_FOR_CERTIFICATION_REVIEW",
        remediation_required: false,
        certification_review_required: true,
        decided_at: "2026-08-18T09:00:00.000Z",
        decided_by_user_id: null,
        readiness_evidence_link_id: "00000000-0000-4000-8000-000000890002"
      }
    };

    mockFetchRoutes([
      ...authRoutes(),
      {
        url: "/api/v1/training/trainees",
        responses: [{ status: 200, body: { trainees: [traineeA] } }]
      },
      {
        url: `/api/v1/training/trainees/${traineeAId}`,
        responses: [{ status: 200, body: traineeA }]
      },
      {
        url: `/api/v1/training/trainees/${traineeAId}/enrollments`,
        responses: [{ status: 200, body: { enrollments: [assignedEnrollmentA] } }]
      },
      workspaceRoute(assignedEnrollmentA, [
        trainingEvidenceWorkspace(assignedEnrollmentA, [
          trainingEvidenceSlot("SKILLS", assignedEnrollmentA, {
            active_draft: skillsRecord,
            history: [skillsRecord],
            can_create_draft: false
          }),
          trainingEvidenceSlot("KNOWLEDGE", assignedEnrollmentA, {
            history: [knowledgeRecord]
          }),
          trainingEvidenceSlot("READINESS", assignedEnrollmentA, {
            history: [readinessRecord]
          })
        ])
      ])
    ]);

    renderWithRoute(routes.registrationTraining);

    expect(await screen.findByText("Open Water Guardian Cohort A")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Skills Assessment" })).toBeInTheDocument();
    expect(screen.getByText("Assigned training facility")).toBeInTheDocument();
    expect(screen.getAllByText("OGI F-023").length).toBeGreaterThan(0);
    expect(screen.getAllByText("OGI F-024").length).toBeGreaterThan(0);
    expect(screen.getAllByText("OGI F-025").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Open Draft" })[0]).toHaveAttribute(
      "href",
      routes.evidenceRecordPath(skillsDraftId)
    );
    expect(screen.getByText("Linked to Enrollment")).toBeInTheDocument();
    expect(screen.getAllByText("Not yet linked").length).toBeGreaterThan(0);
    expect(screen.getByText("Knowledge result: Competent")).toBeInTheDocument();
    expect(screen.getByText("Readiness: Ready For Certification Review")).toBeInTheDocument();
    expect(screen.queryByText(assignedEnrollmentA.id)).not.toBeInTheDocument();
    expect(screen.queryByText(trainingSessionAId)).not.toBeInTheDocument();
    expect(screen.queryByText(clientAId)).not.toBeInTheDocument();
  });

  it("refreshes the workspace instead of duplicating a draft when backend reports conflict", async () => {
    const user = userEvent.setup();
    const activeDraft = trainingEvidenceRecord(independentEnrollmentB);
    mockFetchRoutes([
      ...authRoutes(),
      {
        url: "/api/v1/training/trainees",
        responses: [{ status: 200, body: { trainees: [traineeB] } }]
      },
      {
        url: `/api/v1/training/trainees/${traineeBId}`,
        responses: [{ status: 200, body: traineeB }]
      },
      {
        url: `/api/v1/training/trainees/${traineeBId}/enrollments`,
        responses: [{ status: 200, body: { enrollments: [independentEnrollmentB] } }]
      },
      workspaceRoute(independentEnrollmentB, [
        trainingEvidenceWorkspace(independentEnrollmentB),
        trainingEvidenceWorkspace(independentEnrollmentB, [
          trainingEvidenceSlot("SKILLS", independentEnrollmentB, {
            active_draft: activeDraft,
            history: [activeDraft],
            can_create_draft: false
          }),
          trainingEvidenceSlot("KNOWLEDGE", independentEnrollmentB),
          trainingEvidenceSlot("READINESS", independentEnrollmentB)
        ])
      ]),
      {
        method: "POST",
        url: `/api/v1/training/enrollments/${independentEnrollmentB.id}/evidence-drafts`,
        responses: [
          {
            status: 409,
            body: { message: "Active Training Evidence draft already exists." }
          }
        ]
      }
    ]);

    renderWithRoute(routes.registrationTraining);

    const skillsCard = await screen.findByRole("heading", {
      name: "Skills Assessment"
    });
    await user.click(
      within(skillsCard.closest("article") as HTMLElement).getByRole("button", {
        name: "Create Draft"
      })
    );

    expect(await screen.findByText("An active draft already exists. Workspace refreshed.")).toBeInTheDocument();
    expect((await screen.findAllByRole("link", { name: "Open Draft" }))[0]).toHaveAttribute(
      "href",
      routes.evidenceRecordPath(skillsDraftId)
    );
  });

  it("assigns an initial Training Session to an existing Enrollment through the governed action", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...authRoutes(),
      {
        url: "/api/v1/training/trainees",
        responses: [{ status: 200, body: { trainees: [traineeA] } }]
      },
      {
        url: `/api/v1/training/trainees/${traineeAId}`,
        responses: [{ status: 200, body: traineeA }]
      },
      {
        url: `/api/v1/training/trainees/${traineeAId}/enrollments`,
        responses: [
          { status: 200, body: { enrollments: [enrollmentA] } },
          { status: 200, body: { enrollments: [assignedEnrollmentA] } }
        ]
      },
      workspaceRoute(enrollmentA),
      workspaceRoute(assignedEnrollmentA),
      {
        url: "/api/v1/training/sessions",
        responses: [{ status: 200, body: { sessions: [trainingSessionA] } }]
      },
      {
        method: "POST",
        url: `/api/v1/training/enrollments/${enrollmentA.id}/session-assignment`,
        responses: [{ status: 200, body: assignedEnrollmentA }]
      }
    ]);

    renderWithRoute(routes.registrationTraining);

    expect(await screen.findByText("L3 - Open Water Guardian")).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Assign Training Session" }));
    expect(screen.queryByLabelText(/Session UUID/i)).not.toBeInTheDocument();
    expect(screen.queryByText(trainingSessionAId)).not.toBeInTheDocument();
    expect(
      screen.getByRole("option", {
        name: /Open Water Guardian Cohort A.*Braven Burrows.*Makati Training Pool/
      })
    ).toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText("Training Session"),
      trainingSessionAId
    );
    await user.click(
      screen.getByRole("button", { name: "Save Session Assignment" })
    );

    await screen.findByText("Training Session assigned successfully.");
    expect(await screen.findByText("Open Water Guardian Cohort A")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Assign Training Session" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Change/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reschedule/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Clear/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Attendance/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Completion/i })).not.toBeInTheDocument();

    const assignmentCall = calls.find((call) =>
      call.url.endsWith("/session-assignment")
    );

    expect(JSON.parse(String(assignmentCall?.init?.body))).toEqual({
      training_session_id: trainingSessionAId
    });
    expect(
      calls.filter(
        (call) =>
          call.url === `/api/v1/training/trainees/${traineeAId}/enrollments`
      )
    ).toHaveLength(2);
  });

  it("loads the F-022 Session roster workspace after an operator selects a Training Session", async () => {
    const user = userEvent.setup();
    mockFetchRoutes([
      ...authRoutes(),
      {
        url: "/api/v1/training/trainees",
        responses: [{ status: 200, body: { trainees: [traineeA] } }]
      },
      {
        url: `/api/v1/training/trainees/${traineeAId}`,
        responses: [{ status: 200, body: traineeA }]
      },
      {
        url: `/api/v1/training/trainees/${traineeAId}/enrollments`,
        responses: [{ status: 200, body: { enrollments: [assignedEnrollmentA] } }]
      },
      workspaceRoute(assignedEnrollmentA),
      attendanceWorkspaceRoute()
    ]);

    renderWithRoute(routes.registrationTraining);

    await screen.findByText("F-022 Session Roster");
    await user.selectOptions(
      screen.getByLabelText("Attendance Training Session"),
      trainingSessionAId
    );

    expect(await screen.findByText("Client context")).toBeInTheDocument();
    expect(screen.getAllByText("Ocean Guard International").length).toBeGreaterThan(0);
    expect(screen.getByText("Makati Training Pool")).toBeInTheDocument();
    expect(screen.getByLabelText("Eligible attendance roster")).toBeInTheDocument();
    expect(screen.getByLabelText(/Jane Smith/)).toBeInTheDocument();
    expect(screen.queryByText(trainingSessionAId)).not.toBeInTheDocument();
    expect(screen.queryByText(assignedEnrollmentA.id)).not.toBeInTheDocument();
  });

  it("creates F-022 attendance evidence with only selected enrollment_ids", async () => {
    const user = userEvent.setup();
    const activeDraft = attendanceEvidenceRecord(attendanceDraftId, [
      assignedEnrollmentA,
      assignedIndependentEnrollmentB
    ]);
    const { calls } = mockFetchRoutes([
      ...authRoutes(),
      {
        url: "/api/v1/training/trainees",
        responses: [{ status: 200, body: { trainees: [traineeA] } }]
      },
      {
        url: `/api/v1/training/trainees/${traineeAId}`,
        responses: [{ status: 200, body: traineeA }]
      },
      {
        url: `/api/v1/training/trainees/${traineeAId}/enrollments`,
        responses: [
          {
            status: 200,
            body: {
              enrollments: [assignedEnrollmentA, assignedIndependentEnrollmentB]
            }
          }
        ]
      },
      workspaceRoute(assignedEnrollmentA),
      attendanceWorkspaceRoute([
        attendanceEvidenceWorkspace({
          eligible_enrollments: [
            { enrollment: assignedEnrollmentA, attendance_linked_record_ids: [] },
            {
              enrollment: assignedIndependentEnrollmentB,
              attendance_linked_record_ids: []
            }
          ]
        }),
        attendanceEvidenceWorkspace({
          active_draft: activeDraft,
          eligible_enrollments: [
            { enrollment: assignedEnrollmentA, attendance_linked_record_ids: [] },
            {
              enrollment: assignedIndependentEnrollmentB,
              attendance_linked_record_ids: []
            }
          ],
          history: [activeDraft],
          can_create_draft: false
        })
      ]),
      {
        method: "POST",
        url: `/api/v1/training/sessions/${trainingSessionAId}/attendance-evidence-drafts`,
        responses: [{ status: 201, body: attendanceDraftResponse() }]
      }
    ]);

    renderWithRoute(routes.registrationTraining);

    await user.selectOptions(
      await screen.findByLabelText("Attendance Training Session"),
      trainingSessionAId
    );
    await screen.findByLabelText(/Jane Smith/);
    await user.click(screen.getByRole("button", { name: "Select All" }));
    await user.click(
      screen.getByRole("button", { name: "Create Attendance Evidence" })
    );

    expect(await screen.findByText("Attendance evidence draft created.")).toBeInTheDocument();
    expect(screen.getByText("Active Attendance Draft")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Open Attendance Draft" })[0]).toHaveAttribute("href", routes.evidenceRecordPath(attendanceDraftId));

    const createCall = calls.find((call) =>
      call.url.endsWith("/attendance-evidence-drafts")
    );
    const createBody = JSON.parse(String(createCall?.init?.body));
    expect(createBody).toEqual({
      enrollment_ids: [assignedEnrollmentA.id, assignedIndependentEnrollmentB.id]
    });
    expect(createBody).not.toHaveProperty("client_id");
    expect(createBody).not.toHaveProperty("facility_id");
    expect(createBody).not.toHaveProperty("template_code");
  });

  it("links submitted F-022 attendance evidence from the persisted roster only", async () => {
    const user = userEvent.setup();
    const submittedRecord = attendanceEvidenceRecord(
      attendanceSubmittedId,
      [assignedEnrollmentA],
      {
        evidence: attendanceEvidenceMetadata(attendanceSubmittedId, "SUBMITTED"),
        can_link: true
      }
    );
    const linkedRecord = {
      ...submittedRecord,
      linked_enrollment_ids: [assignedEnrollmentA.id],
      linked_count: 1,
      can_link: false
    };
    const { calls } = mockFetchRoutes([
      ...authRoutes(),
      {
        url: "/api/v1/training/trainees",
        responses: [{ status: 200, body: { trainees: [traineeA] } }]
      },
      {
        url: `/api/v1/training/trainees/${traineeAId}`,
        responses: [{ status: 200, body: traineeA }]
      },
      {
        url: `/api/v1/training/trainees/${traineeAId}/enrollments`,
        responses: [{ status: 200, body: { enrollments: [assignedEnrollmentA] } }]
      },
      workspaceRoute(assignedEnrollmentA),
      attendanceWorkspaceRoute([
        attendanceEvidenceWorkspace({ history: [submittedRecord] }),
        attendanceEvidenceWorkspace({ history: [linkedRecord] })
      ]),
      {
        method: "POST",
        url: `/api/v1/training/sessions/${trainingSessionAId}/attendance-evidence/${attendanceSubmittedId}/link`,
        responses: [
          {
            status: 200,
            body: {
              evidence_links: [
                {
                  id: "00000000-0000-4000-8000-000000890022",
                  training_enrollment_id: assignedEnrollmentA.id,
                  operational_evidence_record_id: attendanceSubmittedId,
                  evidence_purpose: "ATTENDANCE",
                  created_by_user_id: baseSession.id,
                  linked_at: "2026-08-22T17:00:00.000Z",
                  evidence: attendanceEvidenceMetadata(attendanceSubmittedId, "SUBMITTED")
                }
              ]
            }
          }
        ]
      }
    ]);

    renderWithRoute(routes.registrationTraining);

    await user.selectOptions(
      await screen.findByLabelText("Attendance Training Session"),
      trainingSessionAId
    );
    expect(await screen.findByText("F-022 History")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Attendance Evidence" })).toHaveAttribute(
      "href",
      routes.evidenceRecordPath(attendanceSubmittedId)
    );
    await user.click(screen.getByText("Persisted roster"));
    expect(screen.getAllByText(/Jane Smith/).length).toBeGreaterThan(0);

    await user.click(
      screen.getByRole("button", { name: "Link Attendance Evidence" })
    );

    expect(
      await screen.findByText("Attendance evidence linked to persisted roster.")
    ).toBeInTheDocument();
    expect(await screen.findByText("Linked 1 / 1")).toBeInTheDocument();
    const linkCall = calls.find((call) => call.url.endsWith("/link"));
    expect(linkCall?.init?.body).toBeUndefined();
    expect(calls.some((call) => call.url.includes("training_session_participants"))).toBe(false);
  });

  it("surfaces mixed-scope F-022 roster rejection without mutating generic evidence flows", async () => {
    const user = userEvent.setup();
    const { calls } = mockFetchRoutes([
      ...authRoutes(),
      {
        url: "/api/v1/training/trainees",
        responses: [{ status: 200, body: { trainees: [traineeA] } }]
      },
      {
        url: `/api/v1/training/trainees/${traineeAId}`,
        responses: [{ status: 200, body: traineeA }]
      },
      {
        url: `/api/v1/training/trainees/${traineeAId}/enrollments`,
        responses: [
          {
            status: 200,
            body: {
              enrollments: [assignedEnrollmentA, assignedIndependentEnrollmentB]
            }
          }
        ]
      },
      workspaceRoute(assignedEnrollmentA),
      attendanceWorkspaceRoute([
        attendanceEvidenceWorkspace({
          eligible_enrollments: [
            { enrollment: assignedEnrollmentA, attendance_linked_record_ids: [] },
            {
              enrollment: assignedIndependentEnrollmentB,
              attendance_linked_record_ids: []
            }
          ]
        }),
        attendanceEvidenceWorkspace({
          eligible_enrollments: [
            { enrollment: assignedEnrollmentA, attendance_linked_record_ids: [] },
            {
              enrollment: assignedIndependentEnrollmentB,
              attendance_linked_record_ids: []
            }
          ]
        })
      ]),
      {
        method: "POST",
        url: `/api/v1/training/sessions/${trainingSessionAId}/attendance-evidence-drafts`,
        responses: [
          {
            status: 409,
            statusText: "Conflict",
            body: { message: "mixed client scope is not compatible" }
          }
        ]
      }
    ]);

    renderWithRoute(routes.registrationTraining);

    await user.selectOptions(
      await screen.findByLabelText("Attendance Training Session"),
      trainingSessionAId
    );
    await screen.findByLabelText(/Jane Smith/);
    await user.click(screen.getByRole("button", { name: "Select All" }));
    await user.click(
      screen.getByRole("button", { name: "Create Attendance Evidence" })
    );

    expect(
      await screen.findByText(
        "The selected roster cannot be represented by one attendance evidence record because the enrollments do not share a compatible evidence scope."
      )
    ).toBeInTheDocument();
    expect(calls.filter((call) => call.url.endsWith("/attendance-evidence-drafts"))).toHaveLength(1);
    expect(calls.some((call) => call.url.includes("/api/v1/evidence"))).toBe(false);
  });
  it("hides mutation actions without independent Training permissions", async () => {
    mockFetchRoutes(
      standardRoutes([
        {
          method: "GET",
          url: "/api/v1/auth/me",
          responses: [
            {
              status: 200,
              body: {
                ...baseSession,
                permissions: ["view_training", "view_staff_member", "view_client"]
              }
            }
          ]
        }
      ]).filter(
        (route) =>
          !(route.method === "GET" && route.url === "/api/v1/auth/me" && route.responses[0]?.body === baseSession)
      )
    );

    renderWithRoute(routes.registrationTraining);

    expect(await screen.findByText("Jane Smith")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Register Trainee" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Link Personnel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Enrollment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Assign Training Session" })).not.toBeInTheDocument();
  });
});
