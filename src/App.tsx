import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  ConnectionTab,
  ConnectionInput,
  DatabaseSchema,
  ConnectionColor,
} from "./types";
import { useFavorites } from "./hooks/useFavorites";
import { useTableComments } from "./hooks/useTableComments";
import { useToast } from "./hooks/useToast";
import { useQueryHistory } from "./hooks/useQueryHistory";
import { useQueryFavorites } from "./hooks/useQueryFavorites";
import { useTheme } from "./hooks/useTheme";
import ConnectionTabBar from "./components/ConnectionTabBar";
import HomePage from "./components/HomePage";
import WorkspacePage from "./components/WorkspacePage";
import ToastContainer from "./components/ToastContainer";

const defaultConnection: ConnectionInput = {
  dbType: "mysql",
  host: "127.0.0.1",
  port: 3306,
  user: "root",
  password: "",
  database: "",
  connectionType: "standard",
  socketPath: "",
  name: "",
  color: "blue" as ConnectionColor,
};

function createTab(input?: ConnectionInput): ConnectionTab {
  return {
    id: crypto.randomUUID(),
    page: "home",
    connectionInput: input ?? { ...defaultConnection },
    schema: null,
    activeTable: "",
    activeWorkspaceTab: "query",
    query: "",
    queryResult: null,
    queryError: "",
    executionTimeMs: null,
    schemaMarkdown: "",
    schemaContextStatus: "idle",
    tableRowCounts: {},
    queryHistory: [],
    chatMessages: [],
  };
}

export default function App() {
  const [tabs, setTabs] = useState<ConnectionTab[]>([createTab()]);
  const [activeTabId, setActiveTabId] = useState(tabs[0].id);
  const { favorites, addFavorite, removeFavorite } = useFavorites();
  const { getComment, setComment } = useTableComments();
  const { toasts, addToast, removeToast } = useToast();
  const { history, addEntry, clearHistory } = useQueryHistory();
  const { favorites: queryFavorites, addFavorite: addQueryFavorite, removeFavorite: removeQueryFavorite } = useQueryFavorites();
  const { theme, toggleTheme } = useTheme();

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  const updateTab = useCallback(
    (id: string, patch: Partial<ConnectionTab>) => {
      setTabs((prev) =>
        prev.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab))
      );
    },
    []
  );

  const createNewTab = useCallback(() => {
    const newTab = createTab();
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, []);

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        if (prev.length <= 1) return prev;
        const filtered = prev.filter((t) => t.id !== id);
        if (activeTabId === id) {
          setActiveTabId(filtered[filtered.length - 1].id);
        }
        return filtered;
      });
    },
    [activeTabId]
  );

  const handleConnect = useCallback(
    async (tabId: string, input: ConnectionInput, schema: DatabaseSchema) => {
      updateTab(tabId, {
        page: "workspace",
        connectionInput: input,
        schema,
        activeTable: "",
        activeWorkspaceTab: "query",
        query: "",
        queryResult: null,
        queryError: "",
        executionTimeMs: null,
        schemaContextStatus: "generating",
      });

      // Fire schema MD and row counts in parallel (non-blocking)
      Promise.all([
        invoke<string>("generate_schema_md", { connection: input }).catch(
          () => ""
        ),
        invoke<Record<string, number>>("get_table_row_counts", {
          connection: input,
        }).catch(() => ({})),
      ]).then(([md, counts]) => {
        updateTab(tabId, {
          schemaMarkdown: md,
          schemaContextStatus: md ? "ready" : "error",
          tableRowCounts: counts,
        });
        if (md) {
          addToast("Schema context built successfully", "success");
        }
      });
    },
    [updateTab, addToast]
  );

  const handleDisconnect = useCallback(
    (tabId: string) => {
      updateTab(tabId, {
        page: "home",
        schema: null,
        activeTable: "",
        activeWorkspaceTab: "query",
        query: "",
        queryResult: null,
        queryError: "",
        executionTimeMs: null,
        schemaMarkdown: "",
        schemaContextStatus: "idle",
        tableRowCounts: {},
        queryHistory: [],
        chatMessages: [],
      });
    },
    [updateTab]
  );

  // Keyboard shortcuts: Cmd+T (new tab), Cmd+W (close tab)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "t") {
        e.preventDefault();
        createNewTab();
      }
      if (mod && e.key === "w") {
        e.preventDefault();
        closeTab(activeTabId);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [createNewTab, closeTab, activeTabId]);

  return (
    <div className="appRoot">
      <ConnectionTabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={setActiveTabId}
        onNewTab={createNewTab}
        onCloseTab={closeTab}
      />
      {/* Render all workspace tabs but hide inactive ones so AI requests survive tab switches */}
      {tabs.map((tab) =>
        tab.page === "workspace" && tab.schema ? (
          <div
            key={tab.id}
            style={{ display: tab.id === activeTabId ? "contents" : "none" }}
          >
            <WorkspacePage
              tab={tab}
              updateTab={(patch) => updateTab(tab.id, patch)}
              onDisconnect={() => handleDisconnect(tab.id)}
              getComment={getComment}
              setComment={setComment}
              addToast={addToast}
              queryHistory={history}
              addHistoryEntry={addEntry}
              clearHistory={clearHistory}
              queryFavorites={queryFavorites}
              addQueryFavorite={addQueryFavorite}
              removeQueryFavorite={removeQueryFavorite}
              theme={theme}
              onToggleTheme={toggleTheme}
            />
          </div>
        ) : tab.id === activeTabId ? (
          <HomePage
            key={tab.id}
            tab={tab}
            updateTab={(patch) => updateTab(tab.id, patch)}
            onConnect={(input, schema) =>
              handleConnect(tab.id, input, schema)
            }
            favorites={favorites}
            onAddFavorite={addFavorite}
            onRemoveFavorite={removeFavorite}
          />
        ) : null
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
