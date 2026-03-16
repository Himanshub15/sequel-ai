import { useState, useCallback, useEffect } from "react";
import type { QueryHistoryEntry } from "../types";

const STORAGE_KEY = "query_history";
const MAX_ENTRIES = 50;

export function useQueryHistory() {
  const [history, setHistory] = useState<QueryHistoryEntry[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  const addEntry = useCallback(
    (entry: Omit<QueryHistoryEntry, "id" | "timestamp">) => {
      const full: QueryHistoryEntry = {
        ...entry,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      };
      setHistory((prev) => [full, ...prev].slice(0, MAX_ENTRIES));
    },
    []
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return { history, addEntry, clearHistory };
}
