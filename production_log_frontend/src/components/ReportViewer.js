import React, { useMemo, useState } from "react";
import SeverityBadge from "./SeverityBadge";
import { formatDateTime } from "../utils/time";

/**
 * Try to normalize a "report" structure of unknown schema into sections.
 * The backend stores a JSON report; this viewer aims to be robust across versions.
 */
function normalizeSections(report) {
  if (!report || typeof report !== "object") return [];

  // Preferred: report.sections = [{title, content, findings, ...}]
  if (Array.isArray(report.sections)) return report.sections;

  // Alternate: report.report.sections (some wrappers)
  if (report.report && Array.isArray(report.report.sections)) return report.report.sections;

  // Fallback: if the report has known keys, turn them into sections
  const keys = Object.keys(report);
  return keys.map((k) => ({
    title: k,
    content: report[k]
  }));
}

function asArrayMaybe(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

function renderEvidence(evidence) {
  if (!evidence) return null;
  if (typeof evidence === "string") return <pre className="mono pre">{evidence}</pre>;
  return <pre className="mono pre">{JSON.stringify(evidence, null, 2)}</pre>;
}

/**
 * PUBLIC_INTERFACE
 * Render a structured analysis report.
 * @param {{reportResponse: {run_id:string, upload_id:string, created_at:string, schema_name:string|null, report_version:string|null, report:Object}}} props
 */
export default function ReportViewer({ reportResponse }) {
  const [expanded, setExpanded] = useState(() => new Set());

  const report = reportResponse?.report;
  const sections = useMemo(() => normalizeSections(report), [report]);

  const toggle = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (!reportResponse) {
    return (
      <div className="card">
        <h3 className="card__title">Report</h3>
        <p className="muted">Select a run to view its structured report.</p>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card__header">
          <div>
            <h3 className="card__title">Structured report</h3>
            <div className="card__meta">
              <span>
                Run <span className="mono">{reportResponse.run_id}</span>
              </span>
              <span>•</span>
              <span>Created {formatDateTime(reportResponse.created_at)}</span>
              {reportResponse.schema_name ? (
                <>
                  <span>•</span>
                  <span>Schema {reportResponse.schema_name}</span>
                </>
              ) : null}
              {reportResponse.report_version ? (
                <>
                  <span>•</span>
                  <span>v{reportResponse.report_version}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="kv">
          <div className="kv__row">
            <div className="kv__key">Upload</div>
            <div className="kv__val mono">{reportResponse.upload_id}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h4 className="card__subtitle">Sections</h4>

        {sections.length === 0 ? (
          <p className="muted">No sections found in report JSON.</p>
        ) : (
          <div className="accordion">
            {sections.map((sec, idx) => {
              const key = `${idx}:${sec.title || "section"}`;
              const isOpen = expanded.has(key);

              const findings =
                asArrayMaybe(sec.findings).length > 0
                  ? asArrayMaybe(sec.findings)
                  : asArrayMaybe(sec.items || sec.issues || sec.finding_list);

              return (
                <div className="accordion__item" key={key}>
                  <button
                    className="accordion__btn"
                    onClick={() => toggle(key)}
                    aria-expanded={isOpen}
                  >
                    <span className="accordion__title">{sec.title || `Section ${idx + 1}`}</span>
                    <span className="accordion__chev">{isOpen ? "▾" : "▸"}</span>
                  </button>

                  {isOpen ? (
                    <div className="accordion__panel">
                      {sec.summary ? <p className="muted">{String(sec.summary)}</p> : null}

                      {sec.content && typeof sec.content === "string" ? (
                        <p>{sec.content}</p>
                      ) : null}

                      {findings.length > 0 ? (
                        <div className="stack">
                          <h5 className="h5">Findings</h5>
                          <div className="grid grid--1">
                            {findings.map((f, fidx) => (
                              <div className="finding" key={`${key}:f:${fidx}`}>
                                <div className="finding__head">
                                  <SeverityBadge severity={f.severity || f.level || "unknown"} />
                                  <div className="finding__title">
                                    {f.title || f.name || `Finding ${fidx + 1}`}
                                  </div>
                                </div>

                                {f.description ? (
                                  <p className="muted">{String(f.description)}</p>
                                ) : null}

                                {f.root_cause ? (
                                  <div className="callout">
                                    <div className="callout__title">Root cause hypothesis</div>
                                    <div className="callout__body">{String(f.root_cause)}</div>
                                  </div>
                                ) : null}

                                {f.recommendations ? (
                                  <div className="callout callout--good">
                                    <div className="callout__title">Recommended steps</div>
                                    <ul className="list">
                                      {asArrayMaybe(f.recommendations).map((r, ridx) => (
                                        <li key={`${key}:r:${ridx}`}>{String(r)}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : null}

                                {f.evidence ? (
                                  <div className="evidence">
                                    <div className="evidence__title">Evidence</div>
                                    {renderEvidence(f.evidence)}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="muted">
                          {sec.content && typeof sec.content === "object" ? (
                            <>
                              <div className="evidence__title">Raw section content</div>
                              <pre className="mono pre">{JSON.stringify(sec.content, null, 2)}</pre>
                            </>
                          ) : (
                            "No findings listed in this section."
                          )}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card">
        <h4 className="card__subtitle">Raw report JSON</h4>
        <pre className="mono pre">{JSON.stringify(report, null, 2)}</pre>
      </div>
    </div>
  );
}

