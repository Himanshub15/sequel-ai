import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ConnectionInput, QueryResultData } from "../types";

type ContentViewProps = {
  connectionInput: ConnectionInput;
  activeTable: string;
  connected: boolean;
};

function quoteTableName(table: string, dbType: string): string {
  if (dbType === "postgres") return `"${table}"`;
  return `\`${table}\``;
}

export default function ContentView({
  connectionInput,
  activeTable,
  connected,
}: ContentViewProps) {
  const [result, setResult] = useState<QueryResultData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!connected || !activeTable) {
      setResult(null);
      setError("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    const quoted = quoteTableName(activeTable, connectionInput.dbType);
    invoke<QueryResultData>("run_query", {
      connection: connectionInput,
      sql: `SELECT * FROM ${quoted} LIMIT 200`,
    })
      .then((data) => {
        if (!cancelled) {
          setResult(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(String(err));
          setResult(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [connected, activeTable, connectionInput]);

  if (!activeTable) {
    return (
      <div className="contentView">
        <div className="contentEmpty">Select a table to view its content.</div>
      </div>
    );
  }

  return (
    <div className="contentView">
      <div className="contentHeader">
        <span>{activeTable}</span>
        {result && (
          <span className="contentCount">
            {result.rows.length} row{result.rows.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {loading && <div className="contentLoading">Loading...</div>}
      {error && <div className="errorLine">{error}</div>}

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

      {result && result.columns.length === 0 && !error && (
        <div className="contentEmpty">Table is empty.</div>
      )}
    </div>
  );
}
