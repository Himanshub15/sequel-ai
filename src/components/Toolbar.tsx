import type { DbType, WorkspaceTab } from "../types";

type ToolbarProps = {
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  databaseName: string;
  dbType: DbType;
  connectionName: string;
  onDisconnect: () => void;
  hasTableSelected: boolean;
  showAiPanel: boolean;
  onToggleAiPanel: () => void;
  onShowShortcuts: () => void;
  databases: string[];
  onSwitchDatabase: (db: string) => void;
};

export default function Toolbar({
  activeTab,
  onTabChange,
  databaseName,
  dbType,
  connectionName,
  onDisconnect,
  hasTableSelected,
  showAiPanel,
  onToggleAiPanel,
  onShowShortcuts,
  databases,
  onSwitchDatabase,
}: ToolbarProps) {
  const dbLabel = dbType === "postgres" ? "PostgreSQL" : "MySQL";

  return (
    <header className="workspaceToolbar">
      <div className="toolbarLeft">
        <span className="toolbarBrand">
          <svg viewBox="0 0 32 32" width="20" height="20" className="toolbarLogo">
            <defs>
              <linearGradient id="logoBg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#007aff"/>
                <stop offset="100%" stopColor="#5856d6"/>
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="7" ry="7" fill="url(#logoBg)"/>
            <g transform="translate(16, 16)">
              <path d="M-7,2 L-7,-6 C-7,-6 -7,-9 0,-9 C7,-9 7,-6 7,-6 L7,2 C7,2 7,5 0,5 C-7,5 -7,2 -7,2 Z" fill="white" opacity="0.85"/>
              <ellipse cx="0" cy="-1.5" rx="7" ry="3" fill="none" stroke="white" strokeOpacity="0.3" strokeWidth="0.7"/>
              <ellipse cx="0" cy="2" rx="7" ry="3" fill="white" opacity="0.7"/>
              <ellipse cx="0" cy="-6" rx="7" ry="3" fill="white" opacity="0.95"/>
            </g>
            <g transform="translate(23, 7)">
              <path d="M0,-4 C0.5,-1 1,-0.5 4,0 C1,0.5 0.5,1 0,4 C-0.5,1 -1,0.5 -4,0 C-1,-0.5 -0.5,-1 0,-4 Z" fill="white" opacity="0.9"/>
            </g>
            <g transform="translate(26.5, 4)">
              <path d="M0,-1.8 C0.2,-0.5 0.5,-0.2 1.8,0 C0.5,0.2 0.2,0.5 0,1.8 C-0.2,0.5 -0.5,0.2 -1.8,0 C-0.5,-0.2 -0.2,-0.5 0,-1.8 Z" fill="white" opacity="0.6"/>
            </g>
          </svg>
          Sequel AI
        </span>
        <span className="toolbarSep">/</span>
        <span className="toolbarCrumb">
          {connectionName ? `${connectionName} — ${dbLabel}` : dbLabel}
        </span>
        <span className="toolbarSep">—</span>
        {databases.length > 1 ? (
          <select
            className="toolbarDbSelect"
            value={databaseName}
            onChange={(e) => onSwitchDatabase(e.target.value)}
          >
            {databases.map((db) => (
              <option key={db} value={db}>{db}</option>
            ))}
          </select>
        ) : (
          <span className="toolbarCrumb">{databaseName}</span>
        )}
      </div>

      <div className="toolbarCenter">
        <div className="segmentedControl">
          {hasTableSelected && (
            <>
              <button
                type="button"
                className={activeTab === "structure" ? "segmentBtn active" : "segmentBtn"}
                onClick={() => onTabChange("structure")}
                title="⌘1"
              >
                Structure
              </button>
              <button
                type="button"
                className={activeTab === "content" ? "segmentBtn active" : "segmentBtn"}
                onClick={() => onTabChange("content")}
                title="⌘2"
              >
                Content
              </button>
              <button
                type="button"
                className={activeTab === "relations" ? "segmentBtn active" : "segmentBtn"}
                onClick={() => onTabChange("relations")}
                title="⌘3"
              >
                Relations
              </button>
              <button
                type="button"
                className={activeTab === "info" ? "segmentBtn active" : "segmentBtn"}
                onClick={() => onTabChange("info")}
                title="⌘4"
              >
                Table Info
              </button>
            </>
          )}
          <button
            type="button"
            className={activeTab === "query" ? "segmentBtn active" : "segmentBtn"}
            onClick={() => onTabChange("query")}
            title="⌘5"
          >
            Query
          </button>
          {hasTableSelected && (
            <button
              type="button"
              className={activeTab === "triggers" ? "segmentBtn active" : "segmentBtn"}
              onClick={() => onTabChange("triggers")}
              title="⌘6"
            >
              Triggers
            </button>
          )}
        </div>
      </div>

      <div className="toolbarRight">
        <button
          type="button"
          className="toolbarIconBtn"
          onClick={onShowShortcuts}
          title="Keyboard Shortcuts (⌘?)"
        >
          ?
        </button>
        <button
          type="button"
          className={`aiToggleBtn ${showAiPanel ? "active" : ""}`}
          onClick={onToggleAiPanel}
          title="Toggle AI Assistant (⌘I)"
        >
          AI
        </button>
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
