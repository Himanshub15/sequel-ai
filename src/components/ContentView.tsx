import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ConnectionInput, QueryResultData, SortState, ToastMessage } from "../types";

type ContentViewProps = {
  connectionInput: ConnectionInput;
  activeTable: string;
  connected: boolean;
  addToast: (message: string, type?: ToastMessage["type"]) => void;
  totalRowCount?: number;
};

function quoteTableName(table: string, dbType: string): string {
  if (dbType === "postgres") return `"${table}"`;
  return `\`${table}\``;
}

function exportCsv(columns: string[], rows: string[][]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    columns.map(escape).join(","),
    ...rows.map((r) => r.map(escape).join(",")),
  ];
  return lines.join("\n");
}

function exportJson(columns: string[], rows: string[][]) {
  const data = rows.map((r) => {
    const obj: Record<string, string> = {};
    columns.forEach((c, i) => {
      obj[c] = r[i];
    });
    return obj;
  });
  return JSON.stringify(data, null, 2);
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ContentView({
  connectionInput,
  activeTable,
  connected,
  addToast,
  totalRowCount,
}: ContentViewProps) {
  const [result, setResult] = useState<QueryResultData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(200);
  const [sort, setSort] = useState<SortState>(null);

  const totalPages = totalRowCount
    ? Math.max(1, Math.ceil(totalRowCount / pageSize))
    : 1;

  const loadData = useCallback(async () => {
    if (!connected || !activeTable) {
      setResult(null);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    const quoted = quoteTableName(activeTable, connectionInput.dbType);
    let sql = `SELECT * FROM ${quoted}`;
    if (sort) {
      const qCol =
        connectionInput.dbType === "postgres"
          ? `"${sort.column}"`
          : `\`${sort.column}\``;
      sql += ` ORDER BY ${qCol} ${sort.direction.toUpperCase()}`;
    }
    sql += ` LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;

    try {
      const data = await invoke<QueryResultData>("run_query", {
        connection: connectionInput,
        sql,
      });
      setResult(data);
    } catch (err) {
      setError(String(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [connected, activeTable, connectionInput, page, pageSize, sort]);

  useEffect(() => {
    setPage(1);
    setSort(null);
  }, [activeTable]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSort = (column: string) => {
    setSort((prev) => {
      if (prev?.column === column) {
        if (prev.direction === "asc") return { column, direction: "desc" };
        return null; // clear
      }
      return { column, direction: "asc" };
    });
    setPage(1);
  };

  const handleCopy = (value: string) => {
    navigator.clipboard.writeText(value);
    addToast("Copied to clipboard", "info");
  };

  const handleExport = (format: "csv" | "json") => {
    if (!result || result.columns.length === 0) return;
    if (format === "csv") {
      downloadFile(
        exportCsv(result.columns, result.rows),
        `${activeTable}.csv`,
        "text/csv"
      );
    } else {
      downloadFile(
        exportJson(result.columns, result.rows),
        `${activeTable}.json`,
        "application/json"
      );
    }
    addToast(`Exported ${result.rows.length} rows as ${format.toUpperCase()}`, "success");
  };

  if (!activeTable) {
    return (
      <div className="contentView">
        <div className="emptyState">
          <svg className="emptyStateIcon" viewBox="0 0 48 48" width="48" height="48">
            <rect x="6" y="10" width="36" height="28" rx="4" fill="none" stroke="currentColor" strokeWidth="2"/>
            <line x1="6" y1="20" x2="42" y2="20" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="6" y1="30" x2="42" y2="30" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="20" y1="20" x2="20" y2="38" stroke="currentColor" strokeWidth="1.2"/>
          </svg>
          <div className="emptyStateText">Select a table to browse its data</div>
        </div>
      </div>
    );
  }

  return (
    <div className="contentView">
      <div className="contentHeader">
        <span className="contentTableName">{activeTable}</span>
        {result && (
          <span className="contentCount">
            {totalRowCount != null
              ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, totalRowCount)} of ${totalRowCount}`
              : `${result.rows.length} rows`}
          </span>
        )}
        <div className="contentActions">
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
        </div>
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
                  <th
                    key={col}
                    className="sortableHeader"
                    onClick={() => handleSort(col)}
                  >
                    {col}
                    {sort?.column === col && (
                      <span className="sortArrow">
                        {sort.direction === "asc" ? " \u2191" : " \u2193"}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, r) => (
                <tr key={r}>
                  <td className="rowNum">{(page - 1) * pageSize + r + 1}</td>
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

      {result && result.columns.length === 0 && !error && (
        <div className="emptyState">
          <div className="emptyStateText">Table is empty</div>
        </div>
      )}

      {/* Pagination controls */}
      {totalRowCount != null && totalRowCount > 0 && (
        <div className="paginationBar">
          <div className="paginationLeft">
            <select
              className="pageSizeSelect"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
              <option value={200}>200 rows</option>
              <option value={500}>500 rows</option>
            </select>
          </div>
          <div className="paginationCenter">
            <button
              type="button"
              className="paginationBtn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              &lsaquo; Prev
            </button>
            <span className="paginationInfo">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="paginationBtn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next &rsaquo;
            </button>
          </div>
          <div className="paginationRight" />
        </div>
      )}
    </div>
  );
}
