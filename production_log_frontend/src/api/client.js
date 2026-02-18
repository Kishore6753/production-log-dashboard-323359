/**
 * Minimal API client for the production_log_backend log analysis endpoints.
 * Uses fetch (no extra dependencies).
 */

/** @type {string} */
const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/+$/, "");

/**
 * PUBLIC_INTERFACE
 * Get the configured API base URL.
 * @returns {string} Base URL (no trailing slash). May be empty if not configured.
 */
export function getApiBaseUrl() {
  return API_BASE_URL;
}

async function parseErrorResponse(resp) {
  let detail = `Request failed (${resp.status})`;
  try {
    const data = await resp.json();
    if (data && typeof data.detail === "string") detail = data.detail;
    else if (data && typeof data.message === "string") detail = data.message;
    else if (data && typeof data.error === "string") detail = data.error;
  } catch {
    // ignore JSON parse errors
  }
  return new Error(detail);
}

async function requestJson(path, { method = "GET", headers = {}, body } = {}) {
  if (!API_BASE_URL) {
    throw new Error(
      "Missing REACT_APP_API_BASE (preferred) or REACT_APP_API_BASE_URL. Set it in the frontend environment to point at the backend."
    );
  }
  const resp = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      ...headers
    },
    body
  });

  if (!resp.ok) throw await parseErrorResponse(resp);
  return resp.json();
}

/**
 * PUBLIC_INTERFACE
 * Upload a log file. Does not run analysis.
 * @param {Object} params
 * @param {File} params.file Browser File object to upload.
 * @param {string=} params.sourceSystem Optional source system.
 * @param {string=} params.environment Optional environment (prod/staging/etc).
 * @returns {Promise<{id:string, original_filename:string, received_at:string, file_size_bytes:number|null, content_type:string|null}>}
 */
export async function uploadLog({ file, sourceSystem, environment }) {
  const form = new FormData();
  form.append("file", file);

  const q = new URLSearchParams();
  if (sourceSystem) q.set("source_system", sourceSystem);
  if (environment) q.set("environment", environment);

  return requestJson(`/v1/uploads${q.toString() ? `?${q.toString()}` : ""}`, {
    method: "POST",
    body: form
  });
}

/**
 * PUBLIC_INTERFACE
 * Run analysis for a previously uploaded log file.
 * @param {Object} params
 * @param {string} params.uploadId Upload UUID.
 * @param {string=} params.incidentName Optional incident name for report.
 * @param {string=} params.sourceSystem Optional source system identifier (stored as parameters).
 * @param {string=} params.environment Optional env identifier (stored as parameters).
 * @param {Object=} params.metadata Optional metadata object.
 * @param {string=} params.parserName Parser identifier (default 'auto').
 * @returns {Promise<{run_id:string, upload_id:string, status:string}>}
 */
export async function analyzeUpload({
  uploadId,
  incidentName,
  sourceSystem,
  environment,
  metadata,
  parserName
}) {
  return requestJson(`/v1/uploads/${encodeURIComponent(uploadId)}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      incident_name: incidentName || null,
      source_system: sourceSystem || null,
      environment: environment || null,
      metadata: metadata || {},
      parser_name: parserName || "auto"
    })
  });
}

/**
 * PUBLIC_INTERFACE
 * Get an analysis run status/summary.
 * @param {string} runId Run UUID.
 * @returns {Promise<{run_id:string, upload_id:string, status:string, started_at:string, finished_at:string|null, summary:Object, error_message:string|null}>}
 */
export async function getRunStatus(runId) {
  return requestJson(`/v1/runs/${encodeURIComponent(runId)}`);
}

/**
 * PUBLIC_INTERFACE
 * Get a structured report for a run.
 * @param {string} runId Run UUID.
 * @returns {Promise<{run_id:string, upload_id:string, created_at:string, schema_name:string|null, report_version:string|null, report:Object}>}
 */
export async function getStructuredReport(runId) {
  return requestJson(`/v1/runs/${encodeURIComponent(runId)}/report`);
}

