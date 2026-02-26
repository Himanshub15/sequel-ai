import { useMemo, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  ConnectionTab,
  QueryResultData,
  DatabaseSchema,
  WorkspaceTab,
  ConnectionColor,
} from "../types";
import { CONNECTION_COLORS } from "../types";
import Toolbar from "./Toolbar";
import TableList from "./TableList";
import ContentView from "./ContentView";
import StructureView from "./StructureView";
import RelationsView from "./RelationsView";
import Editor from "./Editor";
import ResultPanel from "./ResultPanel";
import StatusBar from "./StatusBar";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";

type WorkspacePageProps = {
  tab: ConnectionTab;
  updateTab: (patch: Partial<ConnectionTab>) => void;
  onDisconnect: () => void;
  getComment: (key: string) => string;
  setComment: (key: string, text: string) => void;
};

export default function WorkspacePage({
  tab,
  updateTab,
  onDisconnect,
  getComment,
  setComment,
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
  } = tab;

  const [queryLoading, setQueryLoading] = useState(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  const tableNames = useMemo(
    () => (schema ? schema.tables.map((t) => t.tableName) : []),
    [schema]
  );

  const colorHex =
    CONNECTION_COLORS[connectionInput.color as ConnectionColor] ||
    CONNECTION_COLORS.blue;

  const commentKey = `${connectionInput.database}:${activeTable}`;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const setActiveTable = useCallback(
    (table: string) => {
      updateTab({
        activeTable: table,
        activeWorkspaceTab: "content",
      });
    },
    [updateTab]
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

  // ── Run query ─────────────────────────────────────────────────────────────
  const runQuery = useCallback(async () => {
    if (!query.trim()) return;
    setQueryLoading(true);
    const startTime = performance.now();
    try {
      const result = await invoke<QueryResultData>("run_query", {
        connection: connectionInput,
        sql: query,
      });
      const elapsed = Math.round(performance.now() - startTime);
      updateTab({
        queryResult: result,
        queryError: "",
        executionTimeMs: elapsed,
      });
    } catch (err) {
      const elapsed = Math.round(performance.now() - startTime);
      updateTab({
        queryResult: null,
        queryError: String(err),
        executionTimeMs: elapsed,
      });
    } finally {
      setQueryLoading(false);
    }
  }, [connectionInput, query, updateTab]);

  // ── Create table template ─────────────────────────────────────────────────
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

  // ── Refresh schema ────────────────────────────────────────────────────────
  const handleRefreshSchema = useCallback(async () => {
    try {
      const newSchema = await invoke<DatabaseSchema>("load_schema", {
        connection: connectionInput,
      });
      updateTab({ schema: newSchema });
    } catch (err) {
      console.error("Failed to refresh schema:", err);
    }
  }, [connectionInput, updateTab]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useKeyboardShortcuts({
    runQuery,
    newTab: () => {},
    closeTab: () => {},
    openConnection: () => {},
  });

  // ── Determine which tabs to show ──────────────────────────────────────────
  const hasTableSelected = activeTable !== "";

  // ── Render ────────────────────────────────────────────────────────────────
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
      />

      <section className="workspaceBody">
        <TableList
          tables={tableNames}
          activeTable={activeTable}
          onSelectTable={setActiveTable}
        />

        <main className="workspaceMain">
          {activeWorkspaceTab === "content" && hasTableSelected ? (
            <ContentView
              connectionInput={connectionInput}
              activeTable={activeTable}
              connected={true}
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
          ) : (
            <div className="queryPane">
              <Editor
                query={query}
                onQueryChange={setQuery}
                onRun={runQuery}
                canRun={query.trim().length > 0}
                loading={queryLoading}
              />
              <ResultPanel
                result={queryResult}
                error={queryError}
                executionTimeMs={executionTimeMs}
              />
            </div>
          )}
        </main>
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
      />
    </div>
  );
}
