import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ConnectionInput, TriggerInfo } from "../types";

type TriggersViewProps = {
  connectionInput: ConnectionInput;
  activeTable: string;
};

export default function TriggersView({
  connectionInput,
  activeTable,
}: TriggersViewProps) {
  const [triggers, setTriggers] = useState<TriggerInfo[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!activeTable) return;
    setLoading(true);
    setError("");
    invoke<TriggerInfo[]>("get_table_triggers", {
      connection: connectionInput,
      table: activeTable,
    })
      .then(setTriggers)
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [connectionInput, activeTable]);

  const toggleExpand = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="triggersView">
        <div className="triggersLoading">Loading triggers...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="triggersView">
        <div className="triggersError">{error}</div>
      </div>
    );
  }

  return (
    <div className="triggersView">
      <div className="triggersHeader">
        <h3 className="triggersTitle">Triggers — {activeTable}</h3>
      </div>
      {triggers.length === 0 ? (
        <div className="triggersEmpty">
          <svg viewBox="0 0 48 48" width="32" height="32" className="emptyStateIcon">
            <path d="M24 8v16l12 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" strokeWidth="2"/>
          </svg>
          <div>No triggers defined on this table</div>
        </div>
      ) : (
        <div className="triggersBody">
          <table className="dataTable">
            <thead>
              <tr>
                <th>Trigger Name</th>
                <th>Timing</th>
                <th>Event</th>
                <th>Statement</th>
              </tr>
            </thead>
            <tbody>
              {triggers.map((t) => (
                <tr key={t.triggerName}>
                  <td>{t.triggerName}</td>
                  <td>{t.timing}</td>
                  <td>{t.event}</td>
                  <td>
                    <button
                      type="button"
                      className="triggerExpandBtn"
                      onClick={() => toggleExpand(t.triggerName)}
                    >
                      {expanded.has(t.triggerName) ? "Hide" : "Show"} SQL
                    </button>
                    {expanded.has(t.triggerName) && (
                      <pre className="triggerStatement">{t.statement}</pre>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
