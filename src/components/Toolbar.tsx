import type { DbType, WorkspaceTab } from "../types";

type ToolbarProps = {
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  databaseName: string;
  dbType: DbType;
  connectionName: string;
  onDisconnect: () => void;
  hasTableSelected: boolean;
};

export default function Toolbar({
  activeTab,
  onTabChange,
  databaseName,
  dbType,
  connectionName,
  onDisconnect,
  hasTableSelected,
}: ToolbarProps) {
  const dbLabel = dbType === "postgres" ? "PostgreSQL" : "MySQL";
  const crumb = connectionName
    ? `${connectionName} — ${dbLabel} — ${databaseName}`
    : `${dbLabel} — ${databaseName}`;

  return (
    <header className="workspaceToolbar">
      <div className="toolbarLeft">
        <span className="toolbarBrand">SQL Studio</span>
        <span className="toolbarCrumb">{crumb}</span>
      </div>

      <div className="toolbarCenter">
        <div className="segmentedControl">
          {hasTableSelected && (
            <>
              <button
                type="button"
                className={
                  activeTab === "content" ? "segmentBtn active" : "segmentBtn"
                }
                onClick={() => onTabChange("content")}
              >
                Content
              </button>
              <button
                type="button"
                className={
                  activeTab === "structure" ? "segmentBtn active" : "segmentBtn"
                }
                onClick={() => onTabChange("structure")}
              >
                Structure
              </button>
              <button
                type="button"
                className={
                  activeTab === "relations" ? "segmentBtn active" : "segmentBtn"
                }
                onClick={() => onTabChange("relations")}
              >
                Relations
              </button>
            </>
          )}
          <button
            type="button"
            className={
              activeTab === "query" ? "segmentBtn active" : "segmentBtn"
            }
            onClick={() => onTabChange("query")}
          >
            Query
          </button>
        </div>
      </div>

      <div className="toolbarRight">
        <button
          type="button"
          className="disconnectBtn"
          onClick={onDisconnect}
        >
          Disconnect
        </button>
      </div>
    </header>
  );
}
