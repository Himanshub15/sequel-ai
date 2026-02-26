import { useState } from "react";
import type { QueryResultData } from "../types";

type ResultPanelProps = {
  result: QueryResultData | null;
  error: string;
  executionTimeMs: number | null;
};

type ResultTab = "data" | "messages";

export default function ResultPanel({
  result,
  error,
  executionTimeMs,
}: ResultPanelProps) {
  const [activeTab, setActiveTab] = useState<ResultTab>("data");

  const rowCount = result?.rows.length ?? 0;

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
        {executionTimeMs !== null && (
          <span className="execTime">{executionTimeMs}ms</span>
        )}
      </div>

      <div className="resultBody">
        {activeTab === "data" ? (
          <>
            {error && <div className="errorLine">{error}</div>}
            {!result && !error && (
              <div className="hint">Execute a query to see results.</div>
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
                            className={cell === "NULL" ? "nullVal" : ""}
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
