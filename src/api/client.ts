import { ApiError } from "./errors";

interface AuthRuntime {
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
  onAuthFailure: () => void;
}

interface ApiRequestOptions<T> {
  method?: "GET" | "PATCH" | "POST";
  body?: unknown;
  auth?: boolean;
  headers?: Readonly<Record<string, string>>;
  validate: (value: unknown) => value is T;
}

interface ApiBlobRequestOptions {
  auth?: boolean;
}

export interface ApiBlobResponse {
  blob: Blob;
  filename: string | null;
}

let authRuntime: AuthRuntime | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function configureApiAuth(runtime: AuthRuntime | null) {
  authRuntime = runtime;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions<T>
): Promise<T> {
  return requestOnce(path, options, false);
}

export async function apiBlobRequest(
  path: string,
  options: ApiBlobRequestOptions = {}
): Promise<ApiBlobResponse> {
  return blobRequestOnce(path, options, false);
}

async function requestOnce<T>(
  path: string,
  options: ApiRequestOptions<T>,
  didRetry: boolean
): Promise<T> {
  const response = await fetch(buildUrl(path), {
    method: options.method ?? "GET",
    headers: buildHeaders(options),
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  if (
    response.status === 401 &&
    options.auth !== false &&
    !didRetry &&
    authRuntime
  ) {
    const token = await refreshAccessTokenSingleFlight();

    if (token) {
      return requestOnce(path, options, true);
    }

    authRuntime.onAuthFailure();
  }

  if (!response.ok) {
    throw await normalizeError(response);
  }

  const payload = await readJson(response);

  if (!options.validate(payload)) {
    throw new ApiError({
      code: "MALFORMED_RESPONSE",
      message: "The server returned an unexpected response.",
      status: response.status,
      details: payload
    });
  }

  return payload;
}

async function blobRequestOnce(
  path: string,
  options: ApiBlobRequestOptions,
  didRetry: boolean
): Promise<ApiBlobResponse> {
  const response = await fetch(buildUrl(path), {
    method: "GET",
    headers: buildBlobHeaders(options)
  });

  if (
    response.status === 401 &&
    options.auth !== false &&
    !didRetry &&
    authRuntime
  ) {
    const token = await refreshAccessTokenSingleFlight();

    if (token) {
      return blobRequestOnce(path, options, true);
    }

    authRuntime.onAuthFailure();
  }

  if (!response.ok) {
    throw await normalizeError(response);
  }

  return {
    blob: await response.blob(),
    filename: readContentDispositionFilename(
      response.headers.get("Content-Disposition")
    )
  };
}

async function refreshAccessTokenSingleFlight() {
  if (!authRuntime) {
    return null;
  }

  if (!refreshInFlight) {
    refreshInFlight = authRuntime.refreshAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

function buildHeaders(options: ApiRequestOptions<unknown>) {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (options.auth !== false) {
    const token = authRuntime?.getAccessToken();

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  return headers;
}

function buildBlobHeaders(options: ApiBlobRequestOptions) {
  const headers = new Headers({
    Accept: "application/pdf"
  });

  if (options.auth !== false) {
    const token = authRuntime?.getAccessToken();

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  return headers;
}

function buildUrl(path: string) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") ?? "";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
}

async function normalizeError(response: Response) {
  const payload = await readJson(response);

  if (isRecord(payload) && isRecord(payload.error)) {
    return new ApiError({
      code: stringValue(payload.error.code, `HTTP_${response.status}`),
      message: stringValue(payload.error.message, response.statusText),
      status: response.status,
      details: payload.error.details
    });
  }

  if (isRecord(payload)) {
    return new ApiError({
      code: stringValue(payload.code, `HTTP_${response.status}`),
      message: stringValue(payload.message, response.statusText),
      status: response.status,
      details: payload
    });
  }

  return new ApiError({
    code: `HTTP_${response.status}`,
    message: response.statusText || "Request failed.",
    status: response.status,
    details: payload
  });
}

async function readJson(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readContentDispositionFilename(value: string | null) {
  if (!value) {
    return null;
  }

  const match = /filename="([^"]+)"/i.exec(value) ?? /filename=([^;]+)/i.exec(value);

  return match?.[1]?.trim() ?? null;
}
