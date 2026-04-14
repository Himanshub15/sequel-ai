import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  ConnectionTab,
  QueryResultData,
  DatabaseSchema,
  WorkspaceTab,
  ConnectionColor,
  QueryHistoryEntry,
  QueryFavorite,
  ToastMessage,
} from "../types";
import { CONNECTION_COLORS } from "../types";
import Toolbar from "./Toolbar";
import TableList from "./TableList";
import ContentView from "./ContentView";
import StructureView from "./StructureView";
import RelationsView from "./RelationsView";
import TableInfoView from "./TableInfoView";
import TriggersView from "./TriggersView";
import Editor from "./Editor";
import ResultPanel from "./ResultPanel";
import StatusBar from "./StatusBar";
import AiChatPanel from "./AiChatPanel";
import AiSettingsModal from "./AiSettingsModal";
import ShortcutsModal from "./ShortcutsModal";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useAiSettings } from "../hooks/useAiSettings";

type WorkspacePageProps = {
  tab: ConnectionTab;
  updateTab: (patch: Partial<ConnectionTab>) => void;
  onDisconnect: () => void;
  getComment: (key: string) => string;
  setComment: (key: string, text: string) => void;
  addToast: (message: string, type?: ToastMessage["type"]) => void;
  queryHistory: QueryHistoryEntry[];
  addHistoryEntry: (entry: Omit<QueryHistoryEntry, "id" | "timestamp">) => void;
  clearHistory: () => void;
  queryFavorites: QueryFavorite[];
  addQueryFavorite: (entry: Omit<QueryFavorite, "id" | "createdAt">) => void;
  removeQueryFavorite: (id: string) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
};

export default function WorkspacePage({
  tab,
  updateTab,
  onDisconnect,
  getComment,
  setComment,
  addToast,
  queryHistory,
  addHistoryEntry,
  clearHistory,
  queryFavorites,
  addQueryFavorite,
  removeQueryFavorite,
  theme,
  onToggleTheme,
}: WorkspacePageProps) {
  const {
    connectionInput,
    schema,
    activeTable,
    activeWorkspaceTab,
    query,
    queryResult,
    queryError,
    executionTimeMs,
    schemaMarkdown,
    schemaContextStatus,
    tableRowCounts,
  } = tab;

  const [queryLoading, setQueryLoading] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [databases, setDatabases] = useState<string[]>([]);
  const [aiPanelWidth, setAiPanelWidth] = useState(320);
  const resizing = useRef(false);

  const {
    settings: aiSettings,
    updateSettings: updateAiSettings,
  } = useAiSettings();

  // ── Load database list on mount ─────────────────────────────────────────
  useEffect(() => {
    invoke<string[]>("list_databases", { connection: connectionInput })
      .then(setDatabases)
      .catch(() => setDatabases([connectionInput.database]));
  }, [connectionInput.host, connectionInput.port, connectionInput.user]);

  // ── Resizable AI panel ──────────────────────────────────────────────────
  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const newWidth = Math.max(250, Math.min(500, window.innerWidth - ev.clientX));
      setAiPanelWidth(newWidth);
    };
    const onUp = () => {
      resizing.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  // ── Derived ─────────────────────────────────────────────────────────────
  const tableNames = useMemo(
    () => (schema ? schema.tables.map((t) => t.tableName) : []),
    [schema]
  );

  const colorHex =
    CONNECTION_COLORS[connectionInput.color as ConnectionColor] ||
    CONNECTION_COLORS.blue;

  const commentKey = `${connectionInput.database}:${activeTable}`;

  // ── Handlers ────────────────────────────────────────────────────────────
  const setActiveTable = useCallback(
    (table: string) => {
      updateTab({
        activeTable: table,
        activeWorkspaceTab: "content",
      });
    },
    [updateTab]
  );

  const handleSelectObject = useCallback(
    (name: string, type: "view" | "procedure" | "function") => {
      const q = connectionInput.dbType === "postgres"
        ? type === "view"
          ? `SELECT * FROM "${name}" LIMIT 100;`
          : `-- ${type}: ${name}\n-- Use CALL/SELECT to execute`
        : type === "view"
          ? `SELECT * FROM \`${name}\` LIMIT 100;`
          : type === "procedure"
            ? `CALL \`${name}\`();`
            : `SELECT \`${name}\`();`;
      updateTab({ query: q, activeWorkspaceTab: "query", activeTable: "" });
    },
    [connectionInput.dbType, updateTab]
  );

  const setActiveWorkspaceTab = useCallback(
    (wsTab: WorkspaceTab) => {
      updateTab({ activeWorkspaceTab: wsTab });
    },
    [updateTab]
  );

  const setQuery = useCallback(
    (q: string) => {
      updateTab({ query: q });
    },
    [updateTab]
  );

  // ── Switch database ─────────────────────────────────────────────────────
  const handleSwitchDatabase = useCallback(
    async (db: string) => {
      const newInput = { ...connectionInput, database: db };
      try {
        const newSchema = await invoke<DatabaseSchema>("load_schema", {
          connection: newInput,
        });
        updateTab({
          connectionInput: newInput,
          schema: newSchema,
          activeTable: "",
          activeWorkspaceTab: "query",
          query: "",
          queryResult: null,
          queryError: "",
          schemaContextStatus: "generating",
        });
        Promise.all([
          invoke<string>("generate_schema_md", { connection: newInput }).catch(() => ""),
          invoke<Record<string, number>>("get_table_row_counts", { connection: newInput }).catch(() => ({})),
        ]).then(([md, counts]) => {
          updateTab({
            schemaMarkdown: md,
            schemaContextStatus: md ? "ready" : "error",
            tableRowCounts: counts,
          });
        });
      } catch (err) {
        addToast(`Failed to switch database: ${err}`, "error");
      }
    },
    [connectionInput, updateTab, addToast]
  );

  // ── Run query ───────────────────────────────────────────────────────────
  const runQuery = useCallback(
    async (sqlOverride?: string) => {
      const sql = sqlOverride ?? query;
      if (!sql.trim()) return;
      setQueryLoading(true);
      const startTime = performance.now();
      try {
        const result = await invoke<QueryResultData>("run_query", {
          connection: connectionInput,
          sql,
        });
        const elapsed = Math.round(performance.now() - startTime);
        if (sqlOverride) {
          updateTab({
            query: sql,
            activeWorkspaceTab: "query",
            queryResult: result,
            queryError: "",
            executionTimeMs: elapsed,
          });
        } else {
          updateTab({
            queryResult: result,
            queryError: "",
            executionTimeMs: elapsed,
          });
        }
        addHistoryEntry({
          sql,
          database: connectionInput.database,
          dbType: connectionInput.dbType,
          executionTimeMs: elapsed,
          rowCount: result.rows.length,
          success: true,
        });
      } catch (err) {
        const elapsed = Math.round(performance.now() - startTime);
        updateTab({
          queryResult: null,
          queryError: String(err),
          executionTimeMs: elapsed,
        });
        addHistoryEntry({
          sql,
          database: connectionInput.database,
          dbType: connectionInput.dbType,
          executionTimeMs: elapsed,
          rowCount: 0,
          success: false,
        });
      } finally {
        setQueryLoading(false);
      }
    },
    [connectionInput, query, updateTab, addHistoryEntry]
  );

  // ── Create table template ───────────────────────────────────────────────
  const handleCreateTable = useCallback(() => {
    const template =
      connectionInput.dbType === "postgres"
        ? `CREATE TABLE new_table (\n  id SERIAL PRIMARY KEY,\n  name VARCHAR(255) NOT NULL,\n  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);`
        : `CREATE TABLE new_table (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n  name VARCHAR(255) NOT NULL,\n  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);`;
    updateTab({
      query: template,
      activeWorkspaceTab: "query",
      activeTable: "",
    });
  }, [connectionInput.dbType, updateTab]);

  // ── Refresh schema ──────────────────────────────────────────────────────
  const handleRefreshSchema = useCallback(async () => {
    try {
      const newSchema = await invoke<DatabaseSchema>("load_schema", {
        connection: connectionInput,
      });
      updateTab({ schema: newSchema, schemaContextStatus: "generating" });

      Promise.all([
        invoke<string>("generate_schema_md", { connection: connectionInput }).catch(() => ""),
        invoke<Record<string, number>>("get_table_row_counts", { connection: connectionInput }).catch(() => ({})),
      ]).then(([md, counts]) => {
        updateTab({
          schemaMarkdown: md,
          schemaContextStatus: md ? "ready" : "error",
          tableRowCounts: counts,
        });
        if (md) addToast("Schema context refreshed", "success");
      });
    } catch (err) {
      console.error("Failed to refresh schema:", err);
    }
  }, [connectionInput, updateTab, addToast]);

  // ── AI Panel ────────────────────────────────────────────────────────────
  const toggleAiPanel = useCallback(() => {
    setShowAiPanel((prev) => !prev);
  }, []);

  const handleApplyToEditor = useCallback(
    (sql: string) => {
      updateTab({
        query: sql,
        activeWorkspaceTab: "query",
      });
    },
    [updateTab]
  );

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useKeyboardShortcuts({
    runQuery: () => runQuery(),
    newTab: () => {},
    closeTab: () => {},
    openConnection: () => {},
    toggleAi: toggleAiPanel,
    showShortcuts: () => setShowShortcuts(true),
  });

  const hasTableSelected = activeTable !== "";

  return (
    <div className="workspacePage">
      <div className="connectionColorStrip" style={{ background: colorHex }} />

      <Toolbar
        activeTab={activeWorkspaceTab}
        onTabChange={setActiveWorkspaceTab}
        databaseName={connectionInput.database}
        dbType={connectionInput.dbType}
        connectionName={connectionInput.name}
        onDisconnect={onDisconnect}
        hasTableSelected={hasTableSelected}
        showAiPanel={showAiPanel}
        onToggleAiPanel={toggleAiPanel}
        onShowShortcuts={() => setShowShortcuts(true)}
        databases={databases}
        onSwitchDatabase={handleSwitchDatabase}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />

      <section
        className={`workspaceBody ${showAiPanel ? "workspaceBody--withAi" : ""}`}
        style={showAiPanel ? { "--ai-panel-width": `${aiPanelWidth}px` } as React.CSSProperties : undefined}
      >
        <TableList
          tables={tableNames}
          views={schema?.views ?? []}
          procedures={schema?.procedures ?? []}
          functions={schema?.functions ?? []}
          activeTable={activeTable}
          onSelectTable={setActiveTable}
          onSelectObject={handleSelectObject}
          rowCounts={tableRowCounts}
          dbType={connectionInput.dbType}
          onRunQuery={runQuery}
          onSetQuery={(sql) => {
            updateTab({ query: sql, activeWorkspaceTab: "query", activeTable: "" });
          }}
          addToast={addToast}
        />

        <main className="workspaceMain">
          {activeWorkspaceTab === "content" && hasTableSelected ? (
            <ContentView
              connectionInput={connectionInput}
              activeTable={activeTable}
              connected={true}
              addToast={addToast}
              totalRowCount={tableRowCounts[activeTable]}
              schemaColumns={schema?.tables.find((t) => t.tableName === activeTable)?.columns}
            />
          ) : activeWorkspaceTab === "structure" && hasTableSelected ? (
            <StructureView
              connectionInput={connectionInput}
              activeTable={activeTable}
              databaseName={connectionInput.database}
              tableComment={getComment(commentKey)}
              onCommentChange={(text) => setComment(commentKey, text)}
            />
          ) : activeWorkspaceTab === "relations" && hasTableSelected ? (
            <RelationsView
              connectionInput={connectionInput}
              activeTable={activeTable}
            />
          ) : activeWorkspaceTab === "info" && hasTableSelected ? (
            <TableInfoView
              connectionInput={connectionInput}
              activeTable={activeTable}
            />
          ) : activeWorkspaceTab === "triggers" && hasTableSelected ? (
            <TriggersView
              connectionInput={connectionInput}
              activeTable={activeTable}
            />
          ) : (
            <div className="queryPane">
              <Editor
                query={query}
                onQueryChange={setQuery}
                onRun={runQuery}
                canRun={query.trim().length > 0}
                loading={queryLoading}
                dbType={connectionInput.dbType}
                queryHistory={queryHistory}
                onClearHistory={clearHistory}
                queryFavorites={queryFavorites}
                onAddFavorite={(name: string, sql: string) =>
                  addQueryFavorite({ name, sql, database: connectionInput.database, dbType: connectionInput.dbType })
                }
                onRemoveFavorite={removeQueryFavorite}
              />
              <ResultPanel
                result={queryResult}
                error={queryError}
                executionTimeMs={executionTimeMs}
                addToast={addToast}
              />
            </div>
          )}
        </main>

        {showAiPanel && schema && (
          <>
            <div className="resizeHandle" onMouseDown={startResize} />
            <AiChatPanel
              schema={schema}
              dbType={connectionInput.dbType}
              settings={aiSettings}
              onApplyToEditor={handleApplyToEditor}
              onOpenSettings={() => setShowAiSettings(true)}
              schemaMarkdown={schemaMarkdown}
              messages={tab.chatMessages}
              onMessagesChange={(msgs) => updateTab({ chatMessages: msgs })}
            />
          </>
        )}
      </section>

      <StatusBar
        connected={true}
        dbType={connectionInput.dbType}
        databaseName={connectionInput.database}
        executionTimeMs={activeWorkspaceTab === "query" ? executionTimeMs : null}
        rowCount={
          activeWorkspaceTab === "query" ? (queryResult?.rows.length ?? 0) : 0
        }
        onCreateTable={handleCreateTable}
        onRefreshSchema={handleRefreshSchema}
        schemaContextStatus={schemaContextStatus}
      />

      {showAiSettings && (
        <AiSettingsModal
          settings={aiSettings}
          onSave={updateAiSettings}
          onClose={() => setShowAiSettings(false)}
        />
      )}

      {showShortcuts && (
        <ShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}
    </div>
  );
}
