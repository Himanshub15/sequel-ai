export type DbType = "mysql" | "postgres";
export type ConnectionType = "standard" | "socket" | "ssh";
export type ConnectionColor = "blue" | "green" | "red" | "orange" | "purple";

export const CONNECTION_COLORS: Record<ConnectionColor, string> = {
  blue: "#007aff",
  green: "#34c759",
  red: "#ff3b30",
  orange: "#ff9500",
  purple: "#af52de",
};

export type ConnectionInput = {
  dbType: DbType;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionType: ConnectionType;
  socketPath: string;
  name: string;
  color: ConnectionColor;
};

export type ConnectionState = {
  input: ConnectionInput;
  connected: boolean;
  message: string;
};

export type QueryResultData = {
  columns: string[];
  rows: string[][];
  affectedRows: number;
};

export type TableSchema = {
  tableName: string;
  columns: string[];
};

export type DatabaseSchema = {
  database: string;
  tables: TableSchema[];
  views: string[];
  procedures: string[];
  functions: string[];
};

export type TableInfo = {
  engine: string;
  rowCount: number;
  dataSize: string;
  indexSize: string;
  autoIncrement: string;
  createTime: string;
  updateTime: string;
  collation: string;
  comment: string;
};

export type TriggerInfo = {
  triggerName: string;
  event: string;
  timing: string;
  statement: string;
};

export type TabState = {
  id: string;
  title: string;
  query: string;
  result: QueryResultData | null;
  error: string;
  executionTimeMs: number | null;
};

export type AppPage = "home" | "workspace";

export type WorkspaceTab = "content" | "structure" | "relations" | "info" | "query" | "triggers";

export type FavoriteConnection = {
  id: string;
  name: string;
  color: ConnectionColor;
  dbType: DbType;
  connectionType: ConnectionType;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  socketPath: string;
  createdAt: number;
};

export type ColumnDetail = {
  columnName: string;
  columnType: string;
  isNullable: string;
  columnKey: string;
  columnDefault: string;
  extra: string;
  columnComment: string;
};

export type TableStructure = {
  tableName: string;
  columns: ColumnDetail[];
};

export type ForeignKeyInfo = {
  constraintName: string;
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
};

export type TableRelations = {
  tableName: string;
  foreignKeys: ForeignKeyInfo[];
};

export type TableComments = Record<string, string>;

export type ConnectionTab = {
  id: string;
  page: AppPage;
  connectionInput: ConnectionInput;
  schema: DatabaseSchema | null;
  activeTable: string;
  activeWorkspaceTab: WorkspaceTab;
  query: string;
  queryResult: QueryResultData | null;
  queryError: string;
  executionTimeMs: number | null;
  schemaMarkdown: string;
  schemaContextStatus: SchemaContextStatus;
  tableRowCounts: Record<string, number>;
  queryHistory: QueryHistoryEntry[];
  chatMessages: ChatMessage[];
};

// ── Schema Context ───────────────────────────────────────────────────────────

export type SchemaContextStatus = "idle" | "generating" | "ready" | "error";

// ── Query History ────────────────────────────────────────────────────────────

export type QueryHistoryEntry = {
  id: string;
  sql: string;
  database: string;
  dbType: DbType;
  executionTimeMs: number;
  rowCount: number;
  timestamp: number;
  success: boolean;
};

// ── Query Favorites ─────────────────────────────────────────────────────────

export type QueryFavorite = {
  id: string;
  name: string;
  sql: string;
  database: string;
  dbType: DbType;
  createdAt: number;
};

// ── Toast ────────────────────────────────────────────────────────────────────

export type ToastMessage = {
  id: string;
  message: string;
  type: "success" | "error" | "info";
  timestamp: number;
};

// ── Pagination & Sorting ─────────────────────────────────────────────────────

export type SortState = {
  column: string;
  direction: "asc" | "desc";
} | null;

// ── AI Chat Types ─────────────────────────────────────────────────────────────

export type AiSettings = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type ChatMessageRole = "user" | "assistant" | "system";

export type ChatMessage = {
  id: string;
  role: ChatMessageRole;
  content: string;
  timestamp: number;
  sqlBlocks?: string[];
};
