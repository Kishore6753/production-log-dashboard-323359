import React from "react";

/**
 * PUBLIC_INTERFACE
 * Render a severity badge with consistent coloring.
 * @param {{severity: string}} props
 */
export default function SeverityBadge({ severity }) {
  const sev = String(severity || "").toLowerCase();
  let cls = "sev sev--info";
  if (sev === "critical") cls = "sev sev--critical";
  else if (sev === "high") cls = "sev sev--high";
  else if (sev === "medium" || sev === "moderate") cls = "sev sev--medium";
  else if (sev === "low") cls = "sev sev--low";
  else if (sev === "warning") cls = "sev sev--warning";
  else if (sev === "error") cls = "sev sev--high";

  return (
    <span className={cls} title={`Severity: ${severity || "unknown"}`}>
      {severity || "unknown"}
    </span>
  );
}

