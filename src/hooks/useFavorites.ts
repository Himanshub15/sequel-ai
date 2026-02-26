import { useState, useEffect, useCallback } from "react";
import type { FavoriteConnection, ConnectionInput } from "../types";
import { saveAppData, loadAppData } from "./useAppData";

const FAVORITES_KEY = "favorites";

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteConnection[]>([]);

  useEffect(() => {
    loadAppData<FavoriteConnection[]>(FAVORITES_KEY).then((data) => {
      if (data) setFavorites(data);
    });
  }, []);

  const persist = useCallback(async (updated: FavoriteConnection[]) => {
    setFavorites(updated);
    await saveAppData(FAVORITES_KEY, updated);
  }, []);

  const addFavorite = useCallback(
    async (input: ConnectionInput) => {
      const fav: FavoriteConnection = {
        id: crypto.randomUUID(),
        name: input.name || input.database || "Untitled",
        color: input.color,
        dbType: input.dbType,
        connectionType: input.connectionType,
        host: input.host,
        port: input.port,
        user: input.user,
        password: input.password,
        database: input.database,
        socketPath: input.socketPath,
        createdAt: Date.now(),
      };
      await persist([...favorites, fav]);
    },
    [favorites, persist]
  );

  const removeFavorite = useCallback(
    async (id: string) => {
      await persist(favorites.filter((f) => f.id !== id));
    },
    [favorites, persist]
  );

  return { favorites, addFavorite, removeFavorite };
}
