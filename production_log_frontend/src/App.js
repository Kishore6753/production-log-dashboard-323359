import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import {
  analyzeUpload,
  getApiBaseUrl,
  getRunStatus,
  getStructuredReport,
  uploadLog
} from "./api/client";
import ReportViewer from "./components/ReportViewer";
import SeverityBadge from "./components/SeverityBadge";
import { downloadJson } from "./utils/download";
import { formatDateTime, isWithinWindow, localDateTimeToIso } from "./utils/time";

function summarizeCounts(reportResponse) {
  const report = reportResponse?.report;
  if (!report || typeof report !== "object") return null;

  // Try common summary paths.
  const summary =
    report.summary ||
    (report.report && report.report.summary) ||
    report.dashboard ||
    report.metrics ||
    null;

  if (!summary || typeof summary !== "object") return null;

  // Normalize a few possible count keys.
  const critical = summary.critical_count ?? summary.critical ?? summary.criticals;
  const high = summary.high_count ?? summary.high ?? summary.errors;
  const warning = summary.warning_count ?? summary.warnings ?? summary.warning;
  const info = summary.info_count ?? summary.info ?? summary.infos;

  return { critical, high, warning, info, _raw: summary };
}

// PUBLIC_INTERFACE
function App() {
  const [theme, setTheme] = useState("light");

  // Upload / analyze form state
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [incidentName, setIncidentName] = useState("");
  const [sourceSystem, setSourceSystem] = useState("");
  const [environment, setEnvironment] = useState("");

  // Time filtering for history
  const [fromLocal, setFromLocal] = useState("");
  const [toLocal, setToLocal] = useState("");

  // API + data state
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [lastUpload, setLastUpload] = useState(null);

  /**
   * Run history is stored locally for now.
   * Backend currently exposes:
   *  - POST /v1/uploads
   *  - POST /v1/uploads/{upload_id}/analyze
   *  - GET  /v1/runs/{run_id}
   *  - GET  /v1/runs/{run_id}/report
   *
   * When a list/history endpoint is added, this can be replaced with server-side querying.
   */
  const [runs, setRuns] = useState([]);

  const [selectedRunId, setSelectedRunId] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // PUBLIC_INTERFACE
  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  const fromIso = useMemo(() => localDateTimeToIso(fromLocal), [fromLocal]);
  const toIso = useMemo(() => localDateTimeToIso(toLocal), [toLocal]);

  const filteredRuns = useMemo(() => {
    if (!fromIso && !toIso) return runs;
    return runs.filter((r) => isWithinWindow(r.started_at, fromIso, toIso));
  }, [runs, fromIso, toIso]);

  async function refreshRun(runId) {
    const status = await getRunStatus(runId);
    setRuns((prev) =>
      prev.map((r) => (r.run_id === runId ? { ...r, ...status, _lastRefreshedAt: Date.now() } : r))
    );
    return status;
  }

  async function openRun(runId) {
    setSelectedRunId(runId);
    setSelectedReport(null);
    setError("");

    setBusy(true);
    try {
      const status = await refreshRun(runId);
      if (status.status === "succeeded") {
        const rep = await getStructuredReport(runId);
        setSelectedReport(rep);
      } else {
        setSelectedReport(null);
      }
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onUploadAndAnalyze(e) {
    e.preventDefault();
    setError("");

    if (!selectedFile) {
      setError("Please choose a log file to upload.");
      return;
    }

    setBusy(true);
    try {
      const up = await uploadLog({
        file: selectedFile,
        sourceSystem: sourceSystem || undefined,
        environment: environment || undefined
      });
      setLastUpload(up);

      const runCreate = await analyzeUpload({
        uploadId: up.id,
        incidentName: incidentName || undefined,
        sourceSystem: sourceSystem || undefined,
        environment: environment || undefined,
        metadata: {},
        parserName: "auto"
      });

      // Fetch status and report immediately (analysis is synchronous in current backend).
      const status = await getRunStatus(runCreate.run_id);

      const newRun = {
        run_id: status.run_id,
        upload_id: status.upload_id,
        status: status.status,
        started_at: status.started_at,
        finished_at: status.finished_at,
        summary: status.summary,
        error_message: status.error_message,
        incident_name: incidentName || null,
        source_system: sourceSystem || null,
        environment: environment || null
      };

      setRuns((prev) => [newRun, ...prev]);
      await openRun(status.run_id);

      // Reset file input for convenience (keep metadata fields).
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  function exportSelectedReport() {
    if (!selectedReport) return;
    const fileSafeRun = selectedReport.run_id.slice(0, 8);
    downloadJson({
      data: selectedReport,
      filename: `log-analysis-report_${fileSafeRun}.json`
    });
  }

  const reportCounts = useMemo(() => summarizeCounts(selectedReport), [selectedReport]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand__logo">LA</div>
          <div className="brand__text">
            <div className="brand__name">Log Analysis</div>
            <div className="brand__sub">Production dashboard</div>
          </div>
        </div>

        <nav className="nav">
          <div className="nav__section">Workflow</div>
          <a className="nav__item nav__item--active" href="#upload">
            Upload & Analyze
          </a>
          <a className="nav__item" href="#history">
            Run History
          </a>
          <a className="nav__item" href="#report">
            Report
          </a>

          <div className="nav__section">Settings</div>
          <button className="nav__item nav__btn" onClick={toggleTheme} type="button">
            Theme: {theme === "light" ? "Light" : "Dark"}
          </button>
        </nav>

        <div className="sidebar__footer">
          <div className="muted small">
            API:{" "}
            <span className="mono">
              {getApiBaseUrl() ? getApiBaseUrl() : "REACT_APP_API_BASE_URL not set"}
            </span>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1 className="h1">Production Log Analysis</h1>
            <p className="sub">
              Upload logs, run analysis, review findings with severity/evidence, and export the
              structured report.
            </p>
          </div>

          <div className="topbar__actions">
            <button
              className="btn btn--secondary"
              type="button"
              onClick={() => selectedRunId && refreshRun(selectedRunId)}
              disabled={!selectedRunId || busy}
              title="Refresh status for selected run"
            >
              Refresh
            </button>
            <button
              className="btn btn--primary"
              type="button"
              onClick={exportSelectedReport}
              disabled={!selectedReport}
              title="Download report JSON"
            >
              Export report
            </button>
          </div>
        </header>

        {error ? (
          <div className="alert alert--error" role="alert">
            <div className="alert__title">Request error</div>
            <div className="alert__body">{error}</div>
          </div>
        ) : null}

        <section id="upload" className="grid grid--2">
          <div className="card">
            <h2 className="h2">Upload & analyze</h2>
            <p className="muted">
              Upload a production log file (text/JSON/common formats) and generate a structured
              report with findings, severity, evidence, and troubleshooting steps.
            </p>

            <form className="form" onSubmit={onUploadAndAnalyze}>
              <div className="form__row">
                <label className="label" htmlFor="file">
                  Log file
                </label>
                <input
                  ref={fileInputRef}
                  id="file"
                  className="input"
                  type="file"
                  accept=".log,.txt,.json,text/plain,application/json"
                  onChange={(ev) => setSelectedFile(ev.target.files?.[0] || null)}
                />
                <div className="hint">
                  Tip: upload raw app logs, JSON logs, or mixed lines. Parser is set to{" "}
                  <span className="mono">auto</span>.
                </div>
              </div>

              <div className="form__row">
                <label className="label" htmlFor="incident">
                  Incident name (optional)
                </label>
                <input
                  id="incident"
                  className="input"
                  value={incidentName}
                  onChange={(e) => setIncidentName(e.target.value)}
                  placeholder="e.g. Checkout failures after deploy 2026-02-18"
                />
              </div>

              <div className="form__cols">
                <div className="form__row">
                  <label className="label" htmlFor="sourceSystem">
                    Source system (optional)
                  </label>
                  <input
                    id="sourceSystem"
                    className="input"
                    value={sourceSystem}
                    onChange={(e) => setSourceSystem(e.target.value)}
                    placeholder="e.g. web-api"
                  />
                </div>

                <div className="form__row">
                  <label className="label" htmlFor="env">
                    Environment (optional)
                  </label>
                  <input
                    id="env"
                    className="input"
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value)}
                    placeholder="e.g. prod"
                  />
                </div>
              </div>

              <div className="form__actions">
                <button className="btn btn--primary" type="submit" disabled={busy}>
                  {busy ? "Working…" : "Upload & analyze"}
                </button>
              </div>
            </form>

            {lastUpload ? (
              <div className="callout">
                <div className="callout__title">Last upload</div>
                <div className="kv">
                  <div className="kv__row">
                    <div className="kv__key">ID</div>
                    <div className="kv__val mono">{lastUpload.id}</div>
                  </div>
                  <div className="kv__row">
                    <div className="kv__key">Filename</div>
                    <div className="kv__val">{lastUpload.original_filename}</div>
                  </div>
                  <div className="kv__row">
                    <div className="kv__key">Received</div>
                    <div className="kv__val">{formatDateTime(lastUpload.received_at)}</div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="card">
            <h2 className="h2">Selected run</h2>
            {selectedRunId ? (
              <div className="stack">
                <div className="row row--spread">
                  <div className="mono">{selectedRunId}</div>
                  <div>
                    <SeverityBadge severity={runs.find((r) => r.run_id === selectedRunId)?.status} />
                  </div>
                </div>

                {reportCounts ? (
                  <div className="statgrid">
                    <div className="stat">
                      <div className="stat__k">Critical</div>
                      <div className="stat__v">{reportCounts.critical ?? "-"}</div>
                    </div>
                    <div className="stat">
                      <div className="stat__k">High/Error</div>
                      <div className="stat__v">{reportCounts.high ?? "-"}</div>
                    </div>
                    <div className="stat">
                      <div className="stat__k">Warnings</div>
                      <div className="stat__v">{reportCounts.warning ?? "-"}</div>
                    </div>
                    <div className="stat">
                      <div className="stat__k">Info</div>
                      <div className="stat__v">{reportCounts.info ?? "-"}</div>
                    </div>
                  </div>
                ) : (
                  <p className="muted">
                    Summary counts will appear here if the report includes a summary/metrics block.
                  </p>
                )}

                <div className="hint">
                  Export uses the already persisted structured report response (includes run/upload
                  IDs and full JSON).
                </div>
              </div>
            ) : (
              <p className="muted">Run a new analysis or select an item from run history.</p>
            )}
          </div>
        </section>

        <section id="history" className="card">
          <div className="row row--spread">
            <div>
              <h2 className="h2">Run history</h2>
              <p className="muted">Local session history with time-window filtering.</p>
            </div>
            <div className="filter">
              <div className="filter__item">
                <label className="label label--small" htmlFor="from">
                  From
                </label>
                <input
                  id="from"
                  className="input input--small"
                  type="datetime-local"
                  value={fromLocal}
                  onChange={(e) => setFromLocal(e.target.value)}
                />
              </div>
              <div className="filter__item">
                <label className="label label--small" htmlFor="to">
                  To
                </label>
                <input
                  id="to"
                  className="input input--small"
                  type="datetime-local"
                  value={toLocal}
                  onChange={(e) => setToLocal(e.target.value)}
                />
              </div>
              <button
                className="btn btn--secondary btn--small"
                type="button"
                onClick={() => {
                  setFromLocal("");
                  setToLocal("");
                }}
              >
                Clear
              </button>
            </div>
          </div>

          {filteredRuns.length === 0 ? (
            <p className="muted">No runs in the current time window.</p>
          ) : (
            <div className="tableWrap" role="region" aria-label="Run history table">
              <table className="table">
                <thead>
                  <tr>
                    <th>Run</th>
                    <th>Status</th>
                    <th>Started</th>
                    <th>Finished</th>
                    <th>Incident</th>
                    <th>Source</th>
                    <th>Env</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRuns.map((r) => (
                    <tr key={r.run_id} className={r.run_id === selectedRunId ? "isSelected" : ""}>
                      <td className="mono">{r.run_id.slice(0, 8)}</td>
                      <td>
                        <span className={`pill pill--${r.status}`}>{r.status}</span>
                      </td>
                      <td>{formatDateTime(r.started_at)}</td>
                      <td>{formatDateTime(r.finished_at)}</td>
                      <td>{r.incident_name || "-"}</td>
                      <td>{r.source_system || "-"}</td>
                      <td>{r.environment || "-"}</td>
                      <td className="tRight">
                        <button
                          className="btn btn--secondary btn--small"
                          type="button"
                          onClick={() => openRun(r.run_id)}
                          disabled={busy}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section id="report" className="report">
          <ReportViewer reportResponse={selectedReport} />
        </section>

        <footer className="footer muted small">
          Note: server-side history listing isn’t available yet (no list runs endpoint). This UI
          stores run history for the current session.
        </footer>
      </main>
    </div>
  );
}

export default App;

