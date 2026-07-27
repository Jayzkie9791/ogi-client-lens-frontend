export interface BackendValidationDetail {
  field: string | null;
  instance_path: string | null;
  rule: string | null;
  message: string;
  params?: Record<string, unknown> | null;
}

export interface OetsValidationSummary {
  formMessages: string[];
  sectionMessages: Record<string, string[]>;
  fieldMessages: Record<string, string[]>;
}

interface ParsedPath {
  sectionCode?: string;
  repeatableIndex?: number;
  fieldCode?: string;
  hasFieldSegment?: boolean;
}

export function mapBackendValidationDetails(
  details: unknown
): OetsValidationSummary {
  const summary: OetsValidationSummary = {
    formMessages: [],
    sectionMessages: {},
    fieldMessages: {}
  };

  if (!Array.isArray(details)) {
    addFormMessage(summary, "The backend returned validation feedback.");
    return summary;
  }

  for (const detail of details) {
    const validationDetail = readValidationDetail(detail);

    if (!validationDetail) {
      addFormMessage(summary, "The backend returned unmapped validation feedback.");
      continue;
    }

    addMappedMessage(summary, validationDetail);
  }

  if (
    summary.formMessages.length === 0 &&
    Object.keys(summary.sectionMessages).length === 0 &&
    Object.keys(summary.fieldMessages).length === 0
  ) {
    addFormMessage(summary, "The submitted evidence did not pass backend validation.");
  }

  return summary;
}

export function fieldErrorKey(
  sectionCode: string,
  fieldCode: string,
  repeatableIndex?: number
) {
  return repeatableIndex === undefined
    ? `${sectionCode}/${fieldCode}`
    : `${sectionCode}/${repeatableIndex}/${fieldCode}`;
}

function addMappedMessage(
  summary: OetsValidationSummary,
  detail: BackendValidationDetail
) {
  const parsedPath = parseInstancePath(detail.instance_path);
  const message = detail.message;
  const paramsSectionCode = readParamsSectionCode(detail);

  if (
    parsedPath.sectionCode &&
    paramsSectionCode &&
    parsedPath.sectionCode !== paramsSectionCode
  ) {
    addFormMessage(summary, message);
    return;
  }

  if (
    parsedPath.fieldCode &&
    detail.field &&
    parsedPath.fieldCode !== detail.field
  ) {
    if (parsedPath.sectionCode) {
      addSectionMessage(summary, parsedPath.sectionCode, message);
      return;
    }

    addFormMessage(summary, message);
    return;
  }

  const sectionCode = parsedPath.sectionCode ?? paramsSectionCode;
  const fieldCode = readFieldCode(detail, parsedPath);

  if (sectionCode && fieldCode) {
    addFieldMessage(
      summary,
      fieldErrorKey(sectionCode, fieldCode, parsedPath.repeatableIndex),
      message
    );
    return;
  }

  if (sectionCode) {
    addSectionMessage(summary, sectionCode, message);
    return;
  }

  addFormMessage(summary, message);
}

function readValidationDetail(value: unknown): BackendValidationDetail | null {
  if (!isRecord(value) || typeof value.message !== "string") {
    return null;
  }

  return {
    field: typeof value.field === "string" ? value.field : null,
    instance_path:
      typeof value.instance_path === "string" ? value.instance_path : null,
    rule: typeof value.rule === "string" ? value.rule : null,
    message: value.message,
    params: isRecord(value.params) ? value.params : null
  };
}

function readFieldCode(
  detail: BackendValidationDetail,
  parsedPath: ParsedPath
) {
  if (parsedPath.fieldCode) {
    return parsedPath.fieldCode;
  }

  if (parsedPath.sectionCode && !parsedPath.hasFieldSegment) {
    return undefined;
  }

  return detail.field ?? undefined;
}

function readParamsSectionCode(detail: BackendValidationDetail) {
  const sectionCode = detail.params?.section_code;

  return typeof sectionCode === "string" && sectionCode.length > 0
    ? sectionCode
    : undefined;
}

function parseInstancePath(path: string | null): ParsedPath {
  if (!path) {
    return {};
  }

  const segments = path.split("/").filter(Boolean);
  const payloadIndex = segments.indexOf("payload");
  const sectionsIndex = segments.indexOf("sections");

  if (
    payloadIndex !== 0 ||
    sectionsIndex !== 1 ||
    typeof segments[2] !== "string"
  ) {
    return {};
  }

  const next = segments[3];

  if (next !== undefined && /^\d+$/.test(next)) {
    return {
      sectionCode: segments[2],
      repeatableIndex: Number(next),
      fieldCode: segments[4],
      hasFieldSegment: segments[4] !== undefined
    };
  }

  return {
    sectionCode: segments[2],
    fieldCode: next,
    hasFieldSegment: next !== undefined
  };
}

function addFormMessage(summary: OetsValidationSummary, message: string) {
  summary.formMessages.push(message);
}

function addSectionMessage(
  summary: OetsValidationSummary,
  sectionCode: string,
  message: string
) {
  summary.sectionMessages[sectionCode] = [
    ...(summary.sectionMessages[sectionCode] ?? []),
    message
  ];
}

function addFieldMessage(
  summary: OetsValidationSummary,
  key: string,
  message: string
) {
  summary.fieldMessages[key] = [...(summary.fieldMessages[key] ?? []), message];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
