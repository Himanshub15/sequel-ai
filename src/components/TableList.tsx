import { useState, useCallback } from "react";
import type { ToastMessage } from "../types";
import TableContextMenu from "./TableContextMenu";

type TableListProps = {
  tables: string[];
  views: string[];
  procedures: string[];
  functions: string[];
  activeTable: string;
  onSelectTable: (tableName: string) => void;
  onSelectObject: (name: string, type: "view" | "procedure" | "function") => void;
  rowCounts: Record<string, number>;
  dbType: string;
  onRunQuery: (sql: string) => void;
  onSetQuery: (sql: string) => void;
  addToast: (message: string, type?: ToastMessage["type"]) => void;
};

function fuzzyMatch(text: string, pattern: string): boolean {
  const lower = text.toLowerCase();
  const pat = pattern.toLowerCase();
  let j = 0;
  for (let i = 0; i < lower.length && j < pat.length; i++) {
    if (lower[i] === pat[j]) j++;
  }
  return j === pat.length;
}

function formatRowCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

type Category = "tables" | "views" | "procedures" | "functions";

export default function TableList({
  tables,
  views,
  procedures,
  functions,
  activeTable,
  onSelectTable,
  onSelectObject,
  rowCounts,
  dbType,
  onRunQuery,
  onSetQuery,
  addToast,
}: TableListProps) {
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Record<Category, boolean>>({
    tables: false,
    views: false,
    procedures: false,
    functions: false,
  });
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    table: string;
  } | null>(null);

  const toggleCategory = (cat: Category) => {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const filteredTables = filter ? tables.filter((t) => fuzzyMatch(t, filter)) : tables;
  const filteredViews = filter ? views.filter((t) => fuzzyMatch(t, filter)) : views;
  const filteredProcs = filter ? procedures.filter((t) => fuzzyMatch(t, filter)) : procedures;
  const filteredFuncs = filter ? functions.filter((t) => fuzzyMatch(t, filter)) : functions;

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, tableName: string) => {
      e.preventDefault();
      setCtxMenu({ x: e.clientX, y: e.clientY, table: tableName });
    },
    []
  );

  const renderCategory = (
    label: string,
    cat: Category,
    items: string[],
    icon: React.ReactNode,
    onClick: (name: string) => void,
    showCounts: boolean,
    showContextMenu: boolean,
  ) => {
    if (items.length === 0 && !filter) return null;

    return (
      <div className="sidebarCategory" key={cat}>
        <button
          type="button"
          className="categoryHeader"
          onClick={() => toggleCategory(cat)}
        >
          <span className={`categoryArrow ${collapsed[cat] ? "" : "expanded"}`}>&#9654;</span>
          <span className="categoryLabel">{label}</span>
          <span className="categoryBadge">{items.length}</span>
        </button>
        {!collapsed[cat] && (
          <div className="categoryItems">
            {items.map((name) => (
              <button
                type="button"
                key={name}
                className={name === activeTable ? "tableItem active" : "tableItem"}
                onClick={() => onClick(name)}
                onContextMenu={showContextMenu ? (e) => handleContextMenu(e, name) : undefined}
              >
                <span className="tableItemIcon">{icon}</span>
                <span className="tableItemName">{name}</span>
                {showCounts && rowCounts[name] != null && (
                  <span className="tableItemCount">{formatRowCount(rowCounts[name])}</span>
                )}
              </button>
            ))}
            {items.length === 0 && (
              <div className="categoryEmpty">No {label.toLowerCase()} match filter</div>
            )}
          </div>
        )}
      </div>
    );
  };

  const tableIcon = (
    <svg viewBox="0 0 16 16" width="14" height="14">
      <rect x="1" y="2" width="14" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="1" y1="6" x2="15" y2="6" stroke="currentColor" strokeWidth="1"/>
      <line x1="6" y1="6" x2="6" y2="14" stroke="currentColor" strokeWidth="0.8"/>
    </svg>
  );
  const viewIcon = (
    <svg viewBox="0 0 16 16" width="14" height="14">
      <ellipse cx="8" cy="8" rx="7" ry="4" fill="none" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="8" cy="8" r="2" fill="currentColor"/>
    </svg>
  );
  const procIcon = (
    <svg viewBox="0 0 16 16" width="14" height="14">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M6 5v6l5-3z" fill="currentColor"/>
    </svg>
  );
  const funcIcon = (
    <svg viewBox="0 0 16 16" width="14" height="14">
      <text x="3" y="12" fontSize="11" fontWeight="bold" fontStyle="italic" fill="currentColor">f</text>
      <text x="8" y="12" fontSize="8" fill="currentColor">(x)</text>
    </svg>
  );

  return (
    <aside className="tableListSidebar">
      <div className="tableSearchWrap">
        <input
          className="tableSearch"
          placeholder="Filter tables..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="tableListScroll">
        {renderCategory("TABLES", "tables", filteredTables, tableIcon, onSelectTable, true, true)}
        {renderCategory("VIEWS", "views", filteredViews, viewIcon, (n) => onSelectObject(n, "view"), false, false)}
        {renderCategory("PROCEDURES", "procedures", filteredProcs, procIcon, (n) => onSelectObject(n, "procedure"), false, false)}
        {renderCategory("FUNCTIONS", "functions", filteredFuncs, funcIcon, (n) => onSelectObject(n, "function"), false, false)}
      </div>

      {ctxMenu && (
        <TableContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          tableName={ctxMenu.table}
          dbType={dbType}
          onClose={() => setCtxMenu(null)}
          onRunQuery={onRunQuery}
          onSetQuery={onSetQuery}
          onCopyName={() => {
            navigator.clipboard.writeText(ctxMenu.table);
            addToast("Table name copied", "info");
          }}
        />
      )}
    </aside>
  );
}
