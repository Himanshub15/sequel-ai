import type { ConnectionTab, ConnectionColor } from "../types";
import { CONNECTION_COLORS } from "../types";

type ConnectionTabBarProps = {
  tabs: ConnectionTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onNewTab: () => void;
  onCloseTab: (id: string) => void;
};

export default function ConnectionTabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onNewTab,
  onCloseTab,
}: ConnectionTabBarProps) {
  if (tabs.length <= 1 && tabs[0]?.page === "home") return null;

  return (
    <div className="connectionTabBar">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const color =
          CONNECTION_COLORS[tab.connectionInput.color as ConnectionColor] ||
          CONNECTION_COLORS.blue;
        const label =
          tab.page === "workspace"
            ? tab.connectionInput.name ||
              tab.connectionInput.database ||
              "Connection"
            : "New Connection";

        return (
          <button
            key={tab.id}
            type="button"
            className={`connTab ${isActive ? "active" : ""}`}
            onClick={() => onSelectTab(tab.id)}
          >
            <span
              className="connTabColorDot"
              style={{ background: color }}
            />
            <span className="connTabLabel">{label}</span>
            {tabs.length > 1 && (
              <span
                className="connTabClose"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
              >
                &times;
              </span>
            )}
          </button>
        );
      })}
      <button
        type="button"
        className="connTabNew"
        onClick={onNewTab}
        title="New connection (⌘T)"
      >
        +
      </button>
    </div>
  );
}
