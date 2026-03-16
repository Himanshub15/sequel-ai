import { useState } from "react";
import type { QueryResultData, ToastMessage } from "../types";

type ResultPanelProps = {
  result: QueryResultData | null;
  error: string;
  executionTimeMs: number | null;
  addToast: (message: string, type?: ToastMessage["type"]) => void;
};

type ResultTab = "data" | "messages";

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ResultPanel({
  result,
  error,
  executionTimeMs,
  addToast,
}: ResultPanelProps) {
  const [activeTab, setActiveTab] = useState<ResultTab>("data");

  const rowCount = result?.rows.length ?? 0;

  const handleExport = (format: "csv" | "json") => {
    if (!result || result.columns.length === 0) return;
    if (format === "csv") {
      const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
      const lines = [
        result.columns.map(escape).join(","),
        ...result.rows.map((r) => r.map(escape).join(",")),
      ];
      downloadFile(lines.join("\n"), "query_result.csv", "text/csv");
    } else {
      const data = result.rows.map((r) => {
        const obj: Record<string, string> = {};
        result.columns.forEach((c, i) => {
          obj[c] = r[i];
        });
        return obj;
      });
      downloadFile(
        JSON.stringify(data, null, 2),
        "query_result.json",
        "application/json"
      );
    }
    addToast(
      `Exported ${result.rows.length} rows as ${format.toUpperCase()}`,
      "success"
    );
  };

  const handleCopy = (value: string) => {
    navigator.clipboard.writeText(value);
    addToast("Copied to clipboard", "info");
  };

  return (
    <div className="resultShell">
      <div className="resultHeader">
        <div className="resultTabs">
          <button
            type="button"
            className={activeTab === "data" ? "rTab active" : "rTab"}
            onClick={() => setActiveTab("data")}
          >
            Data
            {rowCount > 0 && <span className="badge">{rowCount}</span>}
          </button>
          <button
            type="button"
            className={activeTab === "messages" ? "rTab active" : "rTab"}
            onClick={() => setActiveTab("messages")}
          >
            Messages
          </button>
        </div>
        <div className="resultHeaderRight">
          {result && result.columns.length > 0 && (
            <>
              <button
                type="button"
                className="ghostAction small"
                onClick={() => handleExport("csv")}
              >
                CSV
              </button>
              <button
                type="button"
                className="ghostAction small"
                onClick={() => handleExport("json")}
              >
                JSON
              </button>
            </>
          )}
          {executionTimeMs !== null && (
            <span className="execTime">{executionTimeMs}ms</span>
          )}
        </div>
      </div>

      <div className="resultBody">
        {activeTab === "data" ? (
          <>
            {error && <div className="errorLine">{error}</div>}
            {!result && !error && (
              <div className="emptyState">
                <svg className="emptyStateIcon" viewBox="0 0 48 48" width="40" height="40">
                  <rect x="8" y="6" width="32" height="36" rx="3" fill="none" stroke="currentColor" strokeWidth="2"/>
                  <line x1="14" y1="16" x2="34" y2="16" stroke="currentColor" strokeWidth="1.5"/>
                  <line x1="14" y1="22" x2="30" y2="22" stroke="currentColor" strokeWidth="1.5"/>
                  <line x1="14" y1="28" x2="26" y2="28" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M30 32 l6 6 l8-10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="emptyStateText">
                  Run a query with <kbd>⌘ Enter</kbd> to see results
                </div>
              </div>
            )}
            {result && result.columns.length > 0 && (
              <div className="gridWrap">
                <table>
                  <thead>
                    <tr>
                      <th className="rowNumHeader">#</th>
                      {result.columns.map((col) => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, r) => (
                      <tr key={r}>
                        <td className="rowNum">{r + 1}</td>
                        {row.map((cell, c) => (
                          <td
                            key={`${r}-${c}`}
                            className={`cellClickable ${cell === "NULL" ? "nullVal" : ""}`}
                            onClick={() => handleCopy(cell)}
                            title="Click to copy"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {result && result.columns.length === 0 && (
              <div className="hint">
                Statement executed successfully. Affected rows:{" "}
                {result.affectedRows}
              </div>
            )}
          </>
        ) : (
          <div className="messagesPane">
            {error && (
              <div className="msgEntry error">
                <span className="msgIcon">&#x2716;</span> {error}
              </div>
            )}
            {result && executionTimeMs !== null && (
              <div className="msgEntry success">
                <span className="msgIcon">&#x2714;</span> Query executed in{" "}
                {executionTimeMs}ms
                {result.columns.length > 0
                  ? ` — ${rowCount} row${rowCount !== 1 ? "s" : ""} returned`
                  : ` — ${result.affectedRows} row${result.affectedRows !== 1 ? "s" : ""} affected`}
              </div>
            )}
            {!error && !result && (
              <div className="hint">No messages yet.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
