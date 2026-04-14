import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ConnectionInput, QueryResultData, SortState, ToastMessage } from "../types";

type FilterCondition = {
  id: string;
  column: string;
  operator: string;
  value: string;
};

const FILTER_OPERATORS = [
  { label: "=", value: "=" },
  { label: "!=", value: "!=" },
  { label: ">", value: ">" },
  { label: "<", value: "<" },
  { label: ">=", value: ">=" },
  { label: "<=", value: "<=" },
  { label: "LIKE", value: "LIKE" },
  { label: "NOT LIKE", value: "NOT LIKE" },
  { label: "IS NULL", value: "IS NULL" },
  { label: "IS NOT NULL", value: "IS NOT NULL" },
];

const NO_VALUE_OPS = new Set(["IS NULL", "IS NOT NULL"]);

function buildWhereClause(filters: FilterCondition[], dbType: string): string {
  const conditions = filters
    .filter((f) => f.column && f.operator)
    .filter((f) => NO_VALUE_OPS.has(f.operator) || f.value.trim() !== "")
    .map((f) => {
      const col = dbType === "postgres" ? `"${f.column}"` : `\`${f.column}\``;
      if (f.operator === "IS NULL") return `${col} IS NULL`;
      if (f.operator === "IS NOT NULL") return `${col} IS NOT NULL`;
      const val = f.value.replace(/'/g, "''");
      return `${col} ${f.operator} '${val}'`;
    });
  if (conditions.length === 0) return "";
  return ` WHERE ${conditions.join(" AND ")}`;
}

type ContentViewProps = {
  connectionInput: ConnectionInput;
  activeTable: string;
  connected: boolean;
  addToast: (message: string, type?: ToastMessage["type"]) => void;
  totalRowCount?: number;
  schemaColumns?: string[];
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
  schemaColumns,
}: ContentViewProps) {
  const [result, setResult] = useState<QueryResultData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(200);
  const [sort, setSort] = useState<SortState>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<FilterCondition[]>([]);
  const [filteredRowCount, setFilteredRowCount] = useState<number | null>(null);
  const [primaryKeys, setPrimaryKeys] = useState<string[]>([]);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const availableColumns = result?.columns ?? schemaColumns ?? [];

  const effectiveRowCount = filteredRowCount ?? totalRowCount;
  const totalPages = effectiveRowCount
    ? Math.max(1, Math.ceil(effectiveRowCount / pageSize))
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
    const whereClause = buildWhereClause(appliedFilters, connectionInput.dbType);
    let sql = `SELECT * FROM ${quoted}${whereClause}`;
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

      // Get filtered count if filters are active
      if (appliedFilters.length > 0) {
        invoke<QueryResultData>("run_query", {
          connection: connectionInput,
          sql: `SELECT COUNT(*) as cnt FROM ${quoted}${whereClause}`,
        })
          .then((countResult) => {
            const cnt = parseInt(countResult.rows[0]?.[0] ?? "0", 10);
            setFilteredRowCount(cnt);
          })
          .catch(() => setFilteredRowCount(null));
      } else {
        setFilteredRowCount(null);
      }
    } catch (err) {
      setError(String(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [connected, activeTable, connectionInput, page, pageSize, sort, appliedFilters]);

  useEffect(() => {
    setPage(1);
    setSort(null);
    setFilters([]);
    setAppliedFilters([]);
    setFilteredRowCount(null);
    setShowFilters(false);
    setEditingCell(null);
    setPrimaryKeys([]);
    if (activeTable) {
      invoke<string[]>("get_primary_keys", {
        connection: connectionInput,
        table: activeTable,
      })
        .then(setPrimaryKeys)
        .catch(() => setPrimaryKeys([]));
    }
  }, [activeTable, connectionInput]);

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

  // ── Filter handlers ─────────────────────────────────────────────────────
  const addFilter = () => {
    setFilters((prev) => [
      ...prev,
      { id: crypto.randomUUID(), column: availableColumns[0] ?? "", operator: "=", value: "" },
    ]);
  };

  const updateFilter = (id: string, patch: Partial<FilterCondition>) => {
    setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const removeFilter = (id: string) => {
    setFilters((prev) => prev.filter((f) => f.id !== id));
  };

  const applyFilters = () => {
    setAppliedFilters([...filters]);
    setPage(1);
  };

  const clearFilters = () => {
    setFilters([]);
    setAppliedFilters([]);
    setFilteredRowCount(null);
    setPage(1);
  };

  const toggleFilters = () => {
    if (!showFilters && filters.length === 0) {
      addFilter();
    }
    setShowFilters((prev) => !prev);
  };

  // ── Inline editing ──────────────────────────────────────────────────────
  const canEdit = primaryKeys.length > 0;

  const startEdit = (row: number, col: number) => {
    if (!canEdit || !result) return;
    setEditingCell({ row, col });
    setEditValue(result.rows[row][col]);
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const saveEdit = async () => {
    if (!editingCell || !result) return;
    const { row, col } = editingCell;
    const columnName = result.columns[col];
    const oldValue = result.rows[row][col];
    if (editValue === oldValue) {
      cancelEdit();
      return;
    }

    const q = connectionInput.dbType === "postgres" ? '"' : '`';
    const quoted = quoteTableName(activeTable, connectionInput.dbType);
    const setClause = editValue === "NULL"
      ? `${q}${columnName}${q} = NULL`
      : `${q}${columnName}${q} = '${editValue.replace(/'/g, "''")}'`;

    const whereConditions = primaryKeys.map((pk) => {
      const pkIdx = result.columns.indexOf(pk);
      if (pkIdx === -1) return "";
      const val = result.rows[row][pkIdx];
      return val === "NULL"
        ? `${q}${pk}${q} IS NULL`
        : `${q}${pk}${q} = '${val.replace(/'/g, "''")}'`;
    }).filter(Boolean);

    if (whereConditions.length === 0) {
      addToast("Cannot update: no primary key values found", "error");
      cancelEdit();
      return;
    }

    const sql = `UPDATE ${quoted} SET ${setClause} WHERE ${whereConditions.join(" AND ")} LIMIT 1`;
    try {
      await invoke("run_query", { connection: connectionInput, sql });
      addToast("Cell updated", "success");
      cancelEdit();
      loadData();
    } catch (err) {
      addToast(`Update failed: ${err}`, "error");
    }
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
            {effectiveRowCount != null
              ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, effectiveRowCount)} of ${effectiveRowCount}`
              : `${result.rows.length} rows`}
            {appliedFilters.length > 0 && (
              <span className="filterBadge">{appliedFilters.length} filter{appliedFilters.length > 1 ? "s" : ""}</span>
            )}
          </span>
        )}
        <div className="contentActions">
          <button
            type="button"
            className={`ghostAction small ${showFilters ? "active" : ""}`}
            onClick={toggleFilters}
          >
            Filter
          </button>
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

      {showFilters && (
        <div className="filterBar">
          {filters.map((f) => (
            <div key={f.id} className="filterRow">
              <select
                className="filterSelect"
                value={f.column}
                onChange={(e) => updateFilter(f.id, { column: e.target.value })}
              >
                {availableColumns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
              <select
                className="filterSelect filterOpSelect"
                value={f.operator}
                onChange={(e) => updateFilter(f.id, { operator: e.target.value })}
              >
                {FILTER_OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>
              {!NO_VALUE_OPS.has(f.operator) && (
                <input
                  className="filterInput"
                  type="text"
                  placeholder="Value..."
                  value={f.value}
                  onChange={(e) => updateFilter(f.id, { value: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
                />
              )}
              <button
                type="button"
                className="filterRemoveBtn"
                onClick={() => removeFilter(f.id)}
                title="Remove filter"
              >
                &times;
              </button>
            </div>
          ))}
          <div className="filterActions">
            <button type="button" className="ghostAction small" onClick={addFilter}>
              + Add
            </button>
            <button type="button" className="ghostAction small filterApplyBtn" onClick={applyFilters}>
              Apply
            </button>
            {appliedFilters.length > 0 && (
              <button type="button" className="ghostAction small" onClick={clearFilters}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}

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
                      className={`cellClickable ${cell === "NULL" ? "nullVal" : ""} ${canEdit ? "cellEditable" : ""}`}
                      onClick={() => handleCopy(cell)}
                      onDoubleClick={() => startEdit(r, c)}
                      title={canEdit ? "Double-click to edit" : "Click to copy"}
                    >
                      {editingCell?.row === r && editingCell?.col === c ? (
                        <input
                          ref={editInputRef}
                          className="cellEditInput"
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit();
                            if (e.key === "Escape") cancelEdit();
                          }}
                          onBlur={saveEdit}
                          onClick={(e) => e.stopPropagation()}
                          onDoubleClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        cell
                      )}
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
      {effectiveRowCount != null && effectiveRowCount > 0 && (
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
