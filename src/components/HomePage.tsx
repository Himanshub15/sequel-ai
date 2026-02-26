import { FormEvent, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  ConnectionInput,
  ConnectionTab,
  DatabaseSchema,
  DbType,
  ConnectionType,
  ConnectionColor,
  FavoriteConnection,
} from "../types";
import { CONNECTION_COLORS } from "../types";

type HomePageProps = {
  tab: ConnectionTab;
  updateTab: (patch: Partial<ConnectionTab>) => void;
  onConnect: (input: ConnectionInput, schema: DatabaseSchema) => void;
  favorites: FavoriteConnection[];
  onAddFavorite: (input: ConnectionInput) => void;
  onRemoveFavorite: (id: string) => void;
};

const DEFAULT_PORTS: Record<DbType, number> = {
  mysql: 3306,
  postgres: 5432,
};

const COLOR_OPTIONS: ConnectionColor[] = [
  "blue",
  "green",
  "red",
  "orange",
  "purple",
];

export default function HomePage({
  tab,
  updateTab,
  onConnect,
  favorites,
  onAddFavorite,
  onRemoveFavorite,
}: HomePageProps) {
  const [form, setForm] = useState<ConnectionInput>(tab.connectionInput);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const setField = <K extends keyof ConnectionInput>(
    key: K,
    value: ConnectionInput[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setTestResult(null);
  };

  const switchDbType = (dbType: DbType) => {
    setForm((prev) => ({
      ...prev,
      dbType,
      port:
        prev.port === DEFAULT_PORTS[prev.dbType]
          ? DEFAULT_PORTS[dbType]
          : prev.port,
    }));
    setTestResult(null);
  };

  const switchConnectionType = (connectionType: ConnectionType) => {
    setForm((prev) => ({ ...prev, connectionType }));
    setTestResult(null);
  };

  const loadFavorite = (fav: FavoriteConnection) => {
    const input: ConnectionInput = {
      dbType: fav.dbType,
      host: fav.host,
      port: fav.port,
      user: fav.user,
      password: fav.password,
      database: fav.database,
      connectionType: fav.connectionType,
      socketPath: fav.socketPath,
      name: fav.name,
      color: fav.color,
    };
    setForm(input);
    setTestResult(null);
    setError("");
  };

  const handleTestConnection = async () => {
    setLoading(true);
    setError("");
    setTestResult(null);
    try {
      const ok = await invoke<boolean>("test_connection", {
        connection: form,
      });
      setTestResult({
        success: ok,
        message: ok ? "Connection successful!" : "Connection failed",
      });
    } catch (err) {
      setTestResult({ success: false, message: String(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setTestResult(null);
    try {
      const ok = await invoke<boolean>("test_connection", {
        connection: form,
      });
      if (!ok) throw new Error("Connection test returned false");

      const schema = await invoke<DatabaseSchema>("load_schema", {
        connection: form,
      });

      onConnect(form, schema);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFavorite = () => {
    onAddFavorite(form);
  };

  return (
    <div className="homePage">
      <div className="homeContainer">
        <div className="homeBranding">SQL Studio</div>
        <div className="homeBrandingSub">
          Connect to MySQL or PostgreSQL databases
        </div>

        <div className="homeColumns">
          {/* ── Favorites Panel ─────────────────────────────────────────── */}
          <div className="favoritesPanel">
            <div className="favoritesHeader">Favorites</div>
            {favorites.length === 0 ? (
              <div className="favoritesEmpty">No saved connections</div>
            ) : (
              <div className="favoritesScroll">
                {favorites.map((fav) => (
                  <div
                    key={fav.id}
                    className="favoriteItem"
                    onClick={() => loadFavorite(fav)}
                  >
                    <span
                      className="favColorDot"
                      style={{
                        background: CONNECTION_COLORS[fav.color] || "#007aff",
                      }}
                    />
                    <span className="favName">{fav.name || fav.database}</span>
                    <button
                      type="button"
                      className="favDelete"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveFavorite(fav.id);
                      }}
                      title="Remove favorite"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Connection Form ─────────────────────────────────────────── */}
          <form className="connectionFormPanel" onSubmit={handleConnect}>
            {/* Connection Name + Color */}
            <div className="formNameRow">
              <label className="formLabel" style={{ flex: 1 }}>
                Connection Name
                <input
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="My Database"
                />
              </label>
              <div className="colorSwatches">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`colorSwatch ${form.color === c ? "active" : ""}`}
                    style={{ background: CONNECTION_COLORS[c] }}
                    onClick={() => setField("color", c)}
                    title={c}
                  />
                ))}
              </div>
            </div>

            {/* DB Type Toggle */}
            <div className="dbTypeToggle">
              <button
                type="button"
                className={
                  form.dbType === "mysql" ? "dbTypeBtn active" : "dbTypeBtn"
                }
                onClick={() => switchDbType("mysql")}
              >
                MySQL
              </button>
              <button
                type="button"
                className={
                  form.dbType === "postgres" ? "dbTypeBtn active" : "dbTypeBtn"
                }
                onClick={() => switchDbType("postgres")}
              >
                PostgreSQL
              </button>
            </div>

            {/* Connection Type Tabs */}
            <div className="connectionTypeTabs">
              <button
                type="button"
                className={`connTypeTab ${form.connectionType === "standard" ? "active" : ""}`}
                onClick={() => switchConnectionType("standard")}
              >
                Standard
              </button>
              <button
                type="button"
                className={`connTypeTab ${form.connectionType === "socket" ? "active" : ""}`}
                onClick={() => switchConnectionType("socket")}
              >
                Socket
              </button>
              <button
                type="button"
                className={`connTypeTab ${form.connectionType === "ssh" ? "active" : ""}`}
                onClick={() => switchConnectionType("ssh")}
              >
                SSH
              </button>
            </div>

            {/* Form Fields */}
            {form.connectionType === "ssh" ? (
              <div className="sshPlaceholder">
                SSH tunneling coming soon
              </div>
            ) : form.connectionType === "socket" ? (
              <div className="formGrid">
                <label className="formLabel full">
                  Socket Path
                  <input
                    value={form.socketPath}
                    onChange={(e) => setField("socketPath", e.target.value)}
                    placeholder={
                      form.dbType === "mysql"
                        ? "/tmp/mysql.sock"
                        : "/var/run/postgresql"
                    }
                  />
                </label>
                <label className="formLabel">
                  Username
                  <input
                    value={form.user}
                    onChange={(e) => setField("user", e.target.value)}
                    placeholder="root"
                  />
                </label>
                <label className="formLabel">
                  Password
                  <input
                    value={form.password}
                    onChange={(e) => setField("password", e.target.value)}
                    type="password"
                    placeholder="password"
                  />
                </label>
                <label className="formLabel full">
                  Database
                  <input
                    value={form.database}
                    onChange={(e) => setField("database", e.target.value)}
                    placeholder="my_database"
                  />
                </label>
              </div>
            ) : (
              <div className="formGrid">
                <label className="formLabel">
                  Host
                  <input
                    value={form.host}
                    onChange={(e) => setField("host", e.target.value)}
                    placeholder="127.0.0.1"
                  />
                </label>
                <label className="formLabel">
                  Port
                  <input
                    value={form.port}
                    onChange={(e) => setField("port", Number(e.target.value))}
                    type="number"
                  />
                </label>
                <label className="formLabel">
                  Username
                  <input
                    value={form.user}
                    onChange={(e) => setField("user", e.target.value)}
                    placeholder="root"
                  />
                </label>
                <label className="formLabel">
                  Password
                  <input
                    value={form.password}
                    onChange={(e) => setField("password", e.target.value)}
                    type="password"
                    placeholder="password"
                  />
                </label>
                <label className="formLabel full">
                  Database
                  <input
                    value={form.database}
                    onChange={(e) => setField("database", e.target.value)}
                    placeholder="my_database"
                  />
                </label>
              </div>
            )}

            {error && <div className="formError">{error}</div>}

            {testResult && (
              <div
                className={`testResult ${testResult.success ? "success" : "error"}`}
              >
                {testResult.message}
              </div>
            )}

            <div className="formActions">
              <button
                type="button"
                className="ghostAction"
                onClick={handleSaveFavorite}
                disabled={loading}
              >
                ★ Save Favorite
              </button>
              <button
                type="button"
                className="ghostAction"
                onClick={handleTestConnection}
                disabled={loading || form.connectionType === "ssh"}
              >
                Test Connection
              </button>
              <button
                type="submit"
                className="primaryAction"
                disabled={loading || form.connectionType === "ssh"}
              >
                {loading ? "Connecting..." : "Connect"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
