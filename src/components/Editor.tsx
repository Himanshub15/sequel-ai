import { useRef, useCallback, useState, useMemo } from "react";
import type { QueryHistoryEntry } from "../types";

type EditorProps = {
  query: string;
  onQueryChange: (query: string) => void;
  onRun: (sqlOverride?: string) => void;
  canRun: boolean;
  loading: boolean;
  dbType: string;
  queryHistory: QueryHistoryEntry[];
  onClearHistory: () => void;
};

const SQL_KEYWORDS = new Set([
  "SELECT", "FROM", "WHERE", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER",
  "CROSS", "ON", "AND", "OR", "NOT", "IN", "BETWEEN", "LIKE", "IS",
  "NULL", "AS", "ORDER", "BY", "GROUP", "HAVING", "LIMIT", "OFFSET",
  "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE", "CREATE",
  "TABLE", "ALTER", "DROP", "INDEX", "DISTINCT", "COUNT", "SUM",
  "AVG", "MIN", "MAX", "CASE", "WHEN", "THEN", "ELSE", "END",
  "UNION", "ALL", "EXISTS", "WITH", "TRUNCATE", "PRIMARY", "KEY",
  "FOREIGN", "REFERENCES", "AUTO_INCREMENT", "SERIAL", "DEFAULT",
  "NOT", "CONSTRAINT", "CASCADE", "IF", "EXPLAIN", "ANALYZE", "SHOW",
  "DESCRIBE", "USE", "DATABASE", "SCHEMA", "GRANT", "REVOKE",
  "BEGIN", "COMMIT", "ROLLBACK", "TRANSACTION", "VIEW", "TRIGGER",
  "PROCEDURE", "FUNCTION", "RETURN", "RETURNS", "DECLARE", "VARCHAR",
  "INT", "INTEGER", "BIGINT", "SMALLINT", "FLOAT", "DOUBLE", "DECIMAL",
  "BOOLEAN", "BOOL", "TEXT", "BLOB", "DATE", "TIME", "TIMESTAMP",
  "DATETIME", "CHAR", "NUMERIC", "REAL", "ASC", "DESC",
]);

function highlightSql(text: string): string {
  return text.replace(
    /('(?:[^'\\]|\\.)*')|("(?:[^"\\]|\\.)*")|(--[^\n]*)|(\b\d+\.?\d*\b)|(\b[A-Za-z_]\w*\b)/g,
    (match, str1, str2, comment, num, word) => {
      if (str1 || str2)
        return `<span class="sqlString">${match}</span>`;
      if (comment)
        return `<span class="sqlComment">${match}</span>`;
      if (num)
        return `<span class="sqlNumber">${match}</span>`;
      if (word && SQL_KEYWORDS.has(word.toUpperCase()))
        return `<span class="sqlKeyword">${word}</span>`;
      return match;
    }
  );
}

export default function Editor({
  query,
  onQueryChange,
  onRun,
  canRun,
  loading,
  dbType,
  queryHistory,
  onClearHistory,
}: EditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const [showHistory, setShowHistory] = useState(false);

  const lines = query.split("\n");
  const lineCount = lines.length;

  const highlighted = useMemo(() => highlightSql(query), [query]);

  const syncScroll = useCallback(() => {
    if (textareaRef.current) {
      if (lineNumbersRef.current)
        lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
      if (highlightRef.current) {
        highlightRef.current.scrollTop = textareaRef.current.scrollTop;
        highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
      }
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = query.substring(0, start) + "  " + query.substring(end);
      onQueryChange(newValue);
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      });
    }
  };

  const getSelectedText = (): string | undefined => {
    const textarea = textareaRef.current;
    if (!textarea) return undefined;
    const { selectionStart, selectionEnd } = textarea;
    if (selectionStart === selectionEnd) return undefined;
    return query.substring(selectionStart, selectionEnd).trim() || undefined;
  };

  const handleRun = () => {
    const selected = getSelectedText();
    onRun(selected);
  };

  const handleExplain = () => {
    const sql = getSelectedText() || query;
    if (!sql.trim()) return;
    const prefix = dbType === "postgres" ? "EXPLAIN ANALYZE " : "EXPLAIN ";
    onRun(prefix + sql.trim());
  };

  const handleHistorySelect = (sql: string) => {
    onQueryChange(sql);
    setShowHistory(false);
  };

  return (
    <div className="editorShell">
      <div className="editorTop">
        <div className="editorActions">
          <button
            type="button"
            className={`editorActionBtn historyBtn ${showHistory ? "active" : ""}`}
            onClick={() => setShowHistory((p) => !p)}
            title="Query History"
          >
            <svg viewBox="0 0 16 16" width="14" height="14">
              <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.3"/>
              <polyline points="8,4 8,8 11,10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>
          <button
            type="button"
            className="editorActionBtn explainBtn"
            onClick={handleExplain}
            disabled={!canRun || loading}
            title="Explain Query"
          >
            Explain
          </button>
          <button
            type="button"
            className="runBtn"
            onClick={handleRun}
            disabled={!canRun || loading}
            title="Run (⌘ Enter) — select text to run partial"
          >
            <span className="runIcon">&#x25b6;</span>
            {loading ? "Running..." : "Run"}
          </button>
        </div>
      </div>

      <div className="editorWithLines">
        <div className="lineNumbers" ref={lineNumbersRef}>
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i + 1} className="lineNum">
              {i + 1}
            </div>
          ))}
        </div>
        <div className="editorTextWrap">
          <div
            ref={highlightRef}
            className="sqlHighlight"
            dangerouslySetInnerHTML={{ __html: highlighted + "\n" }}
          />
          <textarea
            ref={textareaRef}
            className="sqlArea"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onScroll={syncScroll}
            onKeyDown={handleKeyDown}
            placeholder="Write SQL..."
            spellCheck={false}
          />
        </div>
      </div>

      {/* History dropdown */}
      {showHistory && (
        <div className="historyPanel">
          <div className="historyHeader">
            <span className="historyTitle">Query History</span>
            {queryHistory.length > 0 && (
              <button
                type="button"
                className="ghostAction small"
                onClick={() => {
                  onClearHistory();
                  setShowHistory(false);
                }}
              >
                Clear
              </button>
            )}
          </div>
          <div className="historyList">
            {queryHistory.length === 0 ? (
              <div className="historyEmpty">No queries yet</div>
            ) : (
              queryHistory.slice(0, 20).map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="historyItem"
                  onClick={() => handleHistorySelect(entry.sql)}
                >
                  <div className="historyItemSql">
                    {entry.sql.length > 80
                      ? entry.sql.substring(0, 80) + "..."
                      : entry.sql}
                  </div>
                  <div className="historyItemMeta">
                    <span className={entry.success ? "historyOk" : "historyErr"}>
                      {entry.success ? "\u2713" : "\u2717"}
                    </span>
                    <span>{entry.executionTimeMs}ms</span>
                    <span>{entry.rowCount} rows</span>
                    <span>
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
