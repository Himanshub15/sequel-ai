import type { DbType } from "../types";

type StatusBarProps = {
  connected: boolean;
  dbType: DbType;
  databaseName: string;
  executionTimeMs: number | null;
  rowCount: number;
  onCreateTable: () => void;
  onRefreshSchema: () => void;
};

export default function StatusBar({
  connected,
  dbType,
  databaseName,
  executionTimeMs,
  rowCount,
  onCreateTable,
  onRefreshSchema,
}: StatusBarProps) {
  return (
    <footer className="statusBar">
      <div className="statusLeft">
        <span className="statusIndicator" data-on={connected} />
        {connected ? (
          <>
            <span className="statusLabel">
              {dbType === "postgres" ? "PostgreSQL" : "MySQL"}
            </span>
            <span className="statusSep" />
            <span className="statusLabel">{databaseName}</span>
          </>
        ) : (
          <span className="statusLabel">No connection</span>
        )}
        <span className="statusSep" />
        <button
          type="button"
          className="statusBtn"
          onClick={onCreateTable}
          title="Create table template"
        >
          +
        </button>
        <button
          type="button"
          className="statusBtn"
          onClick={onRefreshSchema}
          title="Refresh schema"
        >
          ↻
        </button>
      </div>
      <div className="statusRight">
        {executionTimeMs !== null && (
          <>
            <span className="statusLabel">{executionTimeMs}ms</span>
            <span className="statusSep" />
          </>
        )}
        {rowCount > 0 && (
          <span className="statusLabel">
            {rowCount} row{rowCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </footer>
  );
}
