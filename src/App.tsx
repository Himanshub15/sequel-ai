import { useState, useCallback, useEffect } from "react";
import type {
  ConnectionTab,
  ConnectionInput,
  DatabaseSchema,
  ConnectionColor,
} from "./types";
import { useFavorites } from "./hooks/useFavorites";
import { useTableComments } from "./hooks/useTableComments";
import ConnectionTabBar from "./components/ConnectionTabBar";
import HomePage from "./components/HomePage";
import WorkspacePage from "./components/WorkspacePage";

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
  };
}

export default function App() {
  const [tabs, setTabs] = useState<ConnectionTab[]>([createTab()]);
  const [activeTabId, setActiveTabId] = useState(tabs[0].id);
  const { favorites, addFavorite, removeFavorite } = useFavorites();
  const { getComment, setComment } = useTableComments();

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
    (tabId: string, input: ConnectionInput, schema: DatabaseSchema) => {
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
      });
    },
    [updateTab]
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
      {activeTab.page === "workspace" && activeTab.schema ? (
        <WorkspacePage
          tab={activeTab}
          updateTab={(patch) => updateTab(activeTab.id, patch)}
          onDisconnect={() => handleDisconnect(activeTab.id)}
          getComment={getComment}
          setComment={setComment}
        />
      ) : (
        <HomePage
          tab={activeTab}
          updateTab={(patch) => updateTab(activeTab.id, patch)}
          onConnect={(input, schema) =>
            handleConnect(activeTab.id, input, schema)
          }
          favorites={favorites}
          onAddFavorite={addFavorite}
          onRemoveFavorite={removeFavorite}
        />
      )}
    </div>
  );
}
