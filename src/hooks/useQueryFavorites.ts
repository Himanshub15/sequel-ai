import { useState, useCallback, useEffect } from "react";
import type { QueryFavorite } from "../types";

const STORAGE_KEY = "query_favorites";

export function useQueryFavorites() {
  const [favorites, setFavorites] = useState<QueryFavorite[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  const addFavorite = useCallback(
    (entry: Omit<QueryFavorite, "id" | "createdAt">) => {
      const full: QueryFavorite = {
        ...entry,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      };
      setFavorites((prev) => [full, ...prev]);
    },
    []
  );

  const removeFavorite = useCallback((id: string) => {
    setFavorites((prev) => prev.filter((f) => f.id !== id));
  }, []);

  return { favorites, addFavorite, removeFavorite };
}
