#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use mysql::prelude::Queryable;
use mysql::{params, OptsBuilder, Pool, Value};
use postgres::{types::Type, Client, NoTls};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

// ── Shared types ──────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ConnectionInput {
    db_type: String, // "mysql" or "postgres"
    host: String,
    port: u16,
    user: String,
    password: String,
    database: String,
    #[serde(default)]
    connection_type: Option<String>, // "standard", "socket", or "ssh"
    #[serde(default)]
    socket_path: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    color: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct QueryResultData {
    columns: Vec<String>,
    rows: Vec<Vec<String>>,
    affected_rows: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TableSchema {
    table_name: String,
    columns: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DatabaseSchema {
    database: String,
    tables: Vec<TableSchema>,
    views: Vec<String>,
    procedures: Vec<String>,
    functions: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TableInfo {
    engine: String,
    row_count: i64,
    data_size: String,
    index_size: String,
    auto_increment: String,
    create_time: String,
    update_time: String,
    collation: String,
    comment: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TriggerInfo {
    trigger_name: String,
    event: String,
    timing: String,
    statement: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ColumnDetail {
    column_name: String,
    column_type: String,
    is_nullable: String,
    column_key: String,
    column_default: String,
    extra: String,
    column_comment: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TableStructure {
    table_name: String,
    columns: Vec<ColumnDetail>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ForeignKeyInfo {
    constraint_name: String,
    column_name: String,
    referenced_table: String,
    referenced_column: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TableRelations {
    table_name: String,
    foreign_keys: Vec<ForeignKeyInfo>,
}

// ── MySQL helpers ─────────────────────────────────────────────────────────────

fn build_mysql_opts(c: &ConnectionInput) -> OptsBuilder {
    let conn_type = c.connection_type.as_deref().unwrap_or("standard");
    let mut builder = OptsBuilder::default()
        .user(Some(c.user.clone()))
        .pass(Some(c.password.clone()))
        .db_name(Some(c.database.clone()));

    if conn_type == "socket" {
        if let Some(ref sock) = c.socket_path {
            builder = builder.socket(Some(sock.clone()));
        } else {
            // Default MySQL socket path
            builder = builder.socket(Some("/tmp/mysql.sock".to_string()));
        }
    } else {
        builder = builder
            .ip_or_hostname(Some(c.host.clone()))
            .tcp_port(c.port);
    }

    builder
}

fn open_mysql(c: &ConnectionInput) -> Result<mysql::PooledConn, String> {
    let opts = build_mysql_opts(c);
    let pool = Pool::new(opts).map_err(|e| format!("MySQL pool failed: {e}"))?;
    pool.get_conn()
        .map_err(|e| format!("MySQL connection failed: {e}"))
}

fn mysql_value_to_string(value: Value) -> String {
    match value {
        Value::NULL => "NULL".to_string(),
        Value::Bytes(bytes) => String::from_utf8_lossy(&bytes).to_string(),
        Value::Int(v) => v.to_string(),
        Value::UInt(v) => v.to_string(),
        Value::Float(v) => v.to_string(),
        Value::Double(v) => v.to_string(),
        Value::Date(y, m, d, h, min, s, micros) => {
            format!("{y:04}-{m:02}-{d:02} {h:02}:{min:02}:{s:02}.{micros}")
        }
        Value::Time(is_neg, days, hours, mins, secs, micros) => {
            let sign = if is_neg { "-" } else { "" };
            format!("{sign}{days} {hours:02}:{mins:02}:{secs:02}.{micros}")
        }
    }
}

fn mysql_test(c: &ConnectionInput) -> Result<bool, String> {
    let mut conn = open_mysql(c)?;
    conn.query_drop("SELECT 1")
        .map_err(|e| format!("MySQL ping failed: {e}"))?;
    Ok(true)
}

fn mysql_load_schema(c: &ConnectionInput) -> Result<DatabaseSchema, String> {
    let mut conn = open_mysql(c)?;
    let rows: Vec<(String, String)> = conn
        .exec(
            r#"
            SELECT TABLE_NAME, COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = :db
            ORDER BY TABLE_NAME, ORDINAL_POSITION
            "#,
            params! { "db" => c.database.clone() },
        )
        .map_err(|e| format!("Schema load failed: {e}"))?;

    let mut tables: Vec<TableSchema> = Vec::new();
    for (table_name, column_name) in rows {
        if let Some(last) = tables.last_mut() {
            if last.table_name == table_name {
                last.columns.push(column_name);
                continue;
            }
        }
        tables.push(TableSchema {
            table_name,
            columns: vec![column_name],
        });
    }

    // Fetch views
    let views: Vec<String> = conn
        .exec(
            "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_SCHEMA = :db ORDER BY TABLE_NAME",
            params! { "db" => c.database.clone() },
        )
        .unwrap_or_default();

    // Fetch procedures
    let procedures: Vec<String> = conn
        .exec(
            "SELECT ROUTINE_NAME FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_SCHEMA = :db AND ROUTINE_TYPE = 'PROCEDURE' ORDER BY ROUTINE_NAME",
            params! { "db" => c.database.clone() },
        )
        .unwrap_or_default();

    // Fetch functions
    let functions: Vec<String> = conn
        .exec(
            "SELECT ROUTINE_NAME FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_SCHEMA = :db AND ROUTINE_TYPE = 'FUNCTION' ORDER BY ROUTINE_NAME",
            params! { "db" => c.database.clone() },
        )
        .unwrap_or_default();

    // Filter out views from tables list
    let tables = tables.into_iter().filter(|t| !views.contains(&t.table_name)).collect();

    Ok(DatabaseSchema {
        database: c.database.clone(),
        tables,
        views,
        procedures,
        functions,
    })
}

fn mysql_run_query(c: &ConnectionInput, sql: &str) -> Result<QueryResultData, String> {
    let mut conn = open_mysql(c)?;
    let mut result = conn
        .query_iter(sql)
        .map_err(|e| format!("Query failed: {e}"))?;

    let columns: Vec<String> = result
        .columns()
        .as_ref()
        .iter()
        .map(|col| col.name_str().to_string())
        .collect();

    let mut rows = Vec::new();
    while let Some(row_result) = result.next() {
        let row = row_result.map_err(|e| format!("Row decode failed: {e}"))?;
        let values = row.unwrap().into_iter().map(mysql_value_to_string).collect();
        rows.push(values);
    }

    Ok(QueryResultData {
        columns,
        rows,
        affected_rows: result.affected_rows(),
    })
}

fn mysql_get_table_structure(c: &ConnectionInput, table: &str) -> Result<TableStructure, String> {
    let mut conn = open_mysql(c)?;
    let rows: Vec<(String, String, String, String, Value, String, String)> = conn
        .exec(
            r#"
            SELECT
                COLUMN_NAME,
                COLUMN_TYPE,
                IS_NULLABLE,
                IFNULL(COLUMN_KEY, ''),
                COLUMN_DEFAULT,
                IFNULL(EXTRA, ''),
                IFNULL(COLUMN_COMMENT, '')
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = :db AND TABLE_NAME = :tbl
            ORDER BY ORDINAL_POSITION
            "#,
            params! { "db" => c.database.clone(), "tbl" => table },
        )
        .map_err(|e| format!("Structure query failed: {e}"))?;

    let columns = rows
        .into_iter()
        .map(|(name, col_type, nullable, key, default_val, extra, comment)| {
            ColumnDetail {
                column_name: name,
                column_type: col_type,
                is_nullable: nullable,
                column_key: key,
                column_default: mysql_value_to_string(default_val),
                extra,
                column_comment: comment,
            }
        })
        .collect();

    Ok(TableStructure {
        table_name: table.to_string(),
        columns,
    })
}

fn mysql_get_table_relations(c: &ConnectionInput, table: &str) -> Result<TableRelations, String> {
    let mut conn = open_mysql(c)?;
    let rows: Vec<(String, String, String, String)> = conn
        .exec(
            r#"
            SELECT
                kcu.CONSTRAINT_NAME,
                kcu.COLUMN_NAME,
                kcu.REFERENCED_TABLE_NAME,
                kcu.REFERENCED_COLUMN_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
            JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                ON kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
                AND kcu.TABLE_SCHEMA = tc.TABLE_SCHEMA
                AND kcu.TABLE_NAME = tc.TABLE_NAME
            WHERE kcu.TABLE_SCHEMA = :db
                AND kcu.TABLE_NAME = :tbl
                AND tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
            ORDER BY kcu.ORDINAL_POSITION
            "#,
            params! { "db" => c.database.clone(), "tbl" => table },
        )
        .map_err(|e| format!("Relations query failed: {e}"))?;

    let foreign_keys = rows
        .into_iter()
        .map(|(constraint, col, ref_table, ref_col)| ForeignKeyInfo {
            constraint_name: constraint,
            column_name: col,
            referenced_table: ref_table,
            referenced_column: ref_col,
        })
        .collect();

    Ok(TableRelations {
        table_name: table.to_string(),
        foreign_keys,
    })
}

// ── PostgreSQL helpers ────────────────────────────────────────────────────────

fn open_pg(c: &ConnectionInput) -> Result<Client, String> {
    let conn_type = c.connection_type.as_deref().unwrap_or("standard");

    let conn_str = if conn_type == "socket" {
        let socket_dir = c
            .socket_path
            .as_deref()
            .unwrap_or("/var/run/postgresql");
        format!(
            "host={} user={} password={} dbname={}",
            socket_dir, c.user, c.password, c.database
        )
    } else {
        format!(
            "host={} port={} user={} password={} dbname={}",
            c.host, c.port, c.user, c.password, c.database
        )
    };

    Client::connect(&conn_str, NoTls).map_err(|e| format!("PostgreSQL connection failed: {e}"))
}

fn pg_value_to_string(row: &postgres::Row, idx: usize, col_type: &Type) -> String {
    // Try common types, fall back to string representation
    if let Ok(Some(v)) = row.try_get::<_, Option<String>>(idx) {
        return v;
    }
    if let Ok(Some(v)) = row.try_get::<_, Option<i32>>(idx) {
        return v.to_string();
    }
    if let Ok(Some(v)) = row.try_get::<_, Option<i64>>(idx) {
        return v.to_string();
    }
    if let Ok(Some(v)) = row.try_get::<_, Option<f32>>(idx) {
        return v.to_string();
    }
    if let Ok(Some(v)) = row.try_get::<_, Option<f64>>(idx) {
        return v.to_string();
    }
    if let Ok(Some(v)) = row.try_get::<_, Option<bool>>(idx) {
        return v.to_string();
    }
    if let Ok(Some(v)) = row.try_get::<_, Option<chrono::NaiveDateTime>>(idx) {
        return v.format("%Y-%m-%d %H:%M:%S").to_string();
    }
    if let Ok(Some(v)) = row.try_get::<_, Option<chrono::NaiveDate>>(idx) {
        return v.format("%Y-%m-%d").to_string();
    }
    if let Ok(Some(v)) = row.try_get::<_, Option<chrono::NaiveTime>>(idx) {
        return v.format("%H:%M:%S").to_string();
    }
    // Check for NULL
    let _ = col_type; // silence unused warning
    if row.try_get::<_, Option<String>>(idx).ok().flatten().is_none()
        && row.try_get::<_, Option<i32>>(idx).ok().flatten().is_none()
    {
        return "NULL".to_string();
    }
    "<unsupported>".to_string()
}

fn pg_test(c: &ConnectionInput) -> Result<bool, String> {
    let mut client = open_pg(c)?;
    client
        .simple_query("SELECT 1")
        .map_err(|e| format!("PostgreSQL ping failed: {e}"))?;
    Ok(true)
}

fn pg_load_schema(c: &ConnectionInput) -> Result<DatabaseSchema, String> {
    let mut client = open_pg(c)?;
    let rows = client
        .query(
            "SELECT table_name, column_name \
             FROM information_schema.columns \
             WHERE table_catalog = $1 AND table_schema = 'public' \
             ORDER BY table_name, ordinal_position",
            &[&c.database],
        )
        .map_err(|e| format!("Schema load failed: {e}"))?;

    let mut tables: Vec<TableSchema> = Vec::new();
    for row in &rows {
        let table_name: String = row.get(0);
        let column_name: String = row.get(1);
        if let Some(last) = tables.last_mut() {
            if last.table_name == table_name {
                last.columns.push(column_name);
                continue;
            }
        }
        tables.push(TableSchema {
            table_name,
            columns: vec![column_name],
        });
    }

    // Fetch views
    let view_rows = client
        .query(
            "SELECT table_name FROM information_schema.views WHERE table_catalog = $1 AND table_schema = 'public' ORDER BY table_name",
            &[&c.database],
        )
        .unwrap_or_default();
    let views: Vec<String> = view_rows.iter().map(|r| r.get(0)).collect();

    // Fetch procedures
    let proc_rows = client
        .query(
            "SELECT routine_name FROM information_schema.routines WHERE routine_catalog = $1 AND routine_schema = 'public' AND routine_type = 'PROCEDURE' ORDER BY routine_name",
            &[&c.database],
        )
        .unwrap_or_default();
    let procedures: Vec<String> = proc_rows.iter().map(|r| r.get(0)).collect();

    // Fetch functions
    let func_rows = client
        .query(
            "SELECT routine_name FROM information_schema.routines WHERE routine_catalog = $1 AND routine_schema = 'public' AND routine_type = 'FUNCTION' ORDER BY routine_name",
            &[&c.database],
        )
        .unwrap_or_default();
    let functions: Vec<String> = func_rows.iter().map(|r| r.get(0)).collect();

    // Filter out views from tables list
    let tables = tables.into_iter().filter(|t| !views.contains(&t.table_name)).collect();

    Ok(DatabaseSchema {
        database: c.database.clone(),
        tables,
        views,
        procedures,
        functions,
    })
}

fn pg_run_query(c: &ConnectionInput, sql: &str) -> Result<QueryResultData, String> {
    let mut client = open_pg(c)?;

    // Detect if this is a SELECT-like statement
    let trimmed = sql.trim_start().to_uppercase();
    let is_select = trimmed.starts_with("SELECT")
        || trimmed.starts_with("SHOW")
        || trimmed.starts_with("EXPLAIN")
        || trimmed.starts_with("WITH");

    if is_select {
        let rows = client
            .query(sql, &[])
            .map_err(|e| format!("Query failed: {e}"))?;

        if rows.is_empty() {
            let columns: Vec<String> = if let Ok(stmt) = client.prepare(sql) {
                stmt.columns().iter().map(|c| c.name().to_string()).collect()
            } else {
                vec![]
            };
            return Ok(QueryResultData {
                columns,
                rows: vec![],
                affected_rows: 0,
            });
        }

        let columns: Vec<String> = rows[0]
            .columns()
            .iter()
            .map(|c| c.name().to_string())
            .collect();

        let data_rows: Vec<Vec<String>> = rows
            .iter()
            .map(|row| {
                (0..row.len())
                    .map(|i| pg_value_to_string(row, i, row.columns()[i].type_()))
                    .collect()
            })
            .collect();

        Ok(QueryResultData {
            columns,
            rows: data_rows,
            affected_rows: 0,
        })
    } else {
        let affected = client
            .execute(sql, &[])
            .map_err(|e| format!("Statement failed: {e}"))?;
        Ok(QueryResultData {
            columns: vec![],
            rows: vec![],
            affected_rows: affected,
        })
    }
}

fn pg_get_table_structure(c: &ConnectionInput, table: &str) -> Result<TableStructure, String> {
    let mut client = open_pg(c)?;
    let rows = client
        .query(
            r#"
            SELECT
                c.column_name,
                c.data_type,
                c.is_nullable,
                COALESCE(
                    CASE WHEN pk.column_name IS NOT NULL THEN 'PRI' ELSE '' END,
                    ''
                ) AS column_key,
                COALESCE(c.column_default, '') AS column_default,
                '' AS extra,
                COALESCE(pgd.description, '') AS column_comment
            FROM information_schema.columns c
            LEFT JOIN (
                SELECT kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
                    AND tc.table_name = $2
                    AND tc.table_schema = 'public'
            ) pk ON pk.column_name = c.column_name
            LEFT JOIN pg_catalog.pg_statio_all_tables psat
                ON psat.schemaname = c.table_schema AND psat.relname = c.table_name
            LEFT JOIN pg_catalog.pg_description pgd
                ON pgd.objoid = psat.relid
                AND pgd.objsubid = c.ordinal_position
            WHERE c.table_catalog = $1 AND c.table_schema = 'public' AND c.table_name = $2
            ORDER BY c.ordinal_position
            "#,
            &[&c.database, &table.to_string()],
        )
        .map_err(|e| format!("Structure query failed: {e}"))?;

    let columns = rows
        .iter()
        .map(|row| {
            ColumnDetail {
                column_name: row.get::<_, String>(0),
                column_type: row.get::<_, String>(1),
                is_nullable: row.get::<_, String>(2),
                column_key: row.get::<_, String>(3),
                column_default: row.get::<_, String>(4),
                extra: row.get::<_, String>(5),
                column_comment: row.get::<_, String>(6),
            }
        })
        .collect();

    Ok(TableStructure {
        table_name: table.to_string(),
        columns,
    })
}

fn pg_get_table_relations(c: &ConnectionInput, table: &str) -> Result<TableRelations, String> {
    let mut client = open_pg(c)?;
    let rows = client
        .query(
            r#"
            SELECT
                tc.constraint_name,
                kcu.column_name,
                ccu.table_name AS referenced_table,
                ccu.column_name AS referenced_column
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_name = $1
                AND tc.table_schema = 'public'
            ORDER BY tc.constraint_name
            "#,
            &[&table.to_string()],
        )
        .map_err(|e| format!("Relations query failed: {e}"))?;

    let foreign_keys = rows
        .iter()
        .map(|row| ForeignKeyInfo {
            constraint_name: row.get::<_, String>(0),
            column_name: row.get::<_, String>(1),
            referenced_table: row.get::<_, String>(2),
            referenced_column: row.get::<_, String>(3),
        })
        .collect();

    Ok(TableRelations {
        table_name: table.to_string(),
        foreign_keys,
    })
}

// ── Tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
fn test_connection(connection: ConnectionInput) -> Result<bool, String> {
    match connection.db_type.as_str() {
        "mysql" => mysql_test(&connection),
        "postgres" => pg_test(&connection),
        other => Err(format!("Unsupported database type: {other}")),
    }
}

#[tauri::command]
fn load_schema(connection: ConnectionInput) -> Result<DatabaseSchema, String> {
    match connection.db_type.as_str() {
        "mysql" => mysql_load_schema(&connection),
        "postgres" => pg_load_schema(&connection),
        other => Err(format!("Unsupported database type: {other}")),
    }
}

#[tauri::command]
fn run_query(connection: ConnectionInput, sql: String) -> Result<QueryResultData, String> {
    match connection.db_type.as_str() {
        "mysql" => mysql_run_query(&connection, &sql),
        "postgres" => pg_run_query(&connection, &sql),
        other => Err(format!("Unsupported database type: {other}")),
    }
}

#[tauri::command]
fn get_table_structure(
    connection: ConnectionInput,
    table: String,
) -> Result<TableStructure, String> {
    match connection.db_type.as_str() {
        "mysql" => mysql_get_table_structure(&connection, &table),
        "postgres" => pg_get_table_structure(&connection, &table),
        other => Err(format!("Unsupported database type: {other}")),
    }
}

#[tauri::command]
fn get_table_relations(
    connection: ConnectionInput,
    table: String,
) -> Result<TableRelations, String> {
    match connection.db_type.as_str() {
        "mysql" => mysql_get_table_relations(&connection, &table),
        "postgres" => pg_get_table_relations(&connection, &table),
        other => Err(format!("Unsupported database type: {other}")),
    }
}

#[tauri::command]
fn save_app_data(app: tauri::AppHandle, key: String, value: String) -> Result<(), String> {
    use tauri::Manager;
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot resolve app data directory: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create data dir: {e}"))?;
    let path: PathBuf = dir.join(format!("{key}.json"));
    fs::write(&path, value).map_err(|e| format!("Failed to write {key}.json: {e}"))?;
    Ok(())
}

#[tauri::command]
fn load_app_data(app: tauri::AppHandle, key: String) -> Result<String, String> {
    use tauri::Manager;
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot resolve app data directory: {e}"))?;
    let path: PathBuf = dir.join(format!("{key}.json"));
    if path.exists() {
        fs::read_to_string(&path).map_err(|e| format!("Failed to read {key}.json: {e}"))
    } else {
        Ok("null".to_string())
    }
}

// ── Row Counts ───────────────────────────────────────────────────────────────

fn mysql_get_row_counts(c: &ConnectionInput) -> Result<std::collections::HashMap<String, i64>, String> {
    let mut conn = open_mysql(c)?;
    let rows: Vec<(String, Value)> = conn
        .exec(
            r#"SELECT TABLE_NAME, TABLE_ROWS
               FROM INFORMATION_SCHEMA.TABLES
               WHERE TABLE_SCHEMA = :db AND TABLE_TYPE = 'BASE TABLE'"#,
            params! { "db" => c.database.clone() },
        )
        .map_err(|e| format!("Row counts failed: {e}"))?;

    let mut counts = std::collections::HashMap::new();
    for (name, val) in rows {
        let n: i64 = match val {
            Value::Int(v) => v,
            Value::UInt(v) => v as i64,
            _ => 0,
        };
        counts.insert(name, n);
    }
    Ok(counts)
}

fn pg_get_row_counts(c: &ConnectionInput) -> Result<std::collections::HashMap<String, i64>, String> {
    let mut client = open_pg(c)?;
    let rows = client
        .query(
            "SELECT relname::text, reltuples::bigint \
             FROM pg_class \
             JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace \
             WHERE nspname = 'public' AND relkind = 'r'",
            &[],
        )
        .map_err(|e| format!("Row counts failed: {e}"))?;

    let mut counts = std::collections::HashMap::new();
    for row in &rows {
        let name: String = row.get(0);
        let n: i64 = row.get(1);
        counts.insert(name, n);
    }
    Ok(counts)
}

#[tauri::command]
fn get_table_row_counts(connection: ConnectionInput) -> Result<std::collections::HashMap<String, i64>, String> {
    match connection.db_type.as_str() {
        "mysql" => mysql_get_row_counts(&connection),
        "postgres" => pg_get_row_counts(&connection),
        other => Err(format!("Unsupported database type: {other}")),
    }
}

// ── Schema Markdown Generation ───────────────────────────────────────────────

fn mysql_generate_schema_md(c: &ConnectionInput) -> Result<String, String> {
    let mut conn = open_mysql(c)?;
    let mut md = String::new();
    md.push_str(&format!("# Database: {}\n\n", c.database));
    md.push_str(&format!("**Engine:** MySQL\n\n"));

    // Get all tables with row counts
    let tables: Vec<(String, Value)> = conn
        .exec(
            "SELECT TABLE_NAME, TABLE_ROWS FROM INFORMATION_SCHEMA.TABLES \
             WHERE TABLE_SCHEMA = :db AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME",
            params! { "db" => c.database.clone() },
        )
        .map_err(|e| format!("Schema MD tables failed: {e}"))?;

    md.push_str("## Tables Overview\n\n");
    md.push_str("| Table | Approx Rows |\n|-------|------------|\n");
    let table_names: Vec<String> = tables.iter().map(|(name, _)| name.clone()).collect();
    for (name, rows_val) in &tables {
        let rows: i64 = match rows_val {
            Value::Int(v) => *v,
            Value::UInt(v) => *v as i64,
            _ => 0,
        };
        md.push_str(&format!("| {} | {} |\n", name, rows));
    }
    md.push('\n');

    // Per-table details
    for table_name in &table_names {
        md.push_str(&format!("## Table: `{}`\n\n", table_name));

        // Columns
        let cols: Vec<(String, String, String, String, Value, String, String)> = conn
            .exec(
                r#"SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, IFNULL(COLUMN_KEY, ''),
                          COLUMN_DEFAULT, IFNULL(EXTRA, ''), IFNULL(COLUMN_COMMENT, '')
                   FROM INFORMATION_SCHEMA.COLUMNS
                   WHERE TABLE_SCHEMA = :db AND TABLE_NAME = :tbl
                   ORDER BY ORDINAL_POSITION"#,
                params! { "db" => c.database.clone(), "tbl" => table_name.clone() },
            )
            .map_err(|e| format!("Schema MD columns failed: {e}"))?;

        md.push_str("### Columns\n\n");
        md.push_str("| Column | Type | Nullable | Key | Default | Extra | Comment |\n");
        md.push_str("|--------|------|----------|-----|---------|-------|--------|\n");
        for (col_name, col_type, nullable, key, default_val, extra, comment) in &cols {
            let def = mysql_value_to_string(default_val.clone());
            md.push_str(&format!(
                "| {} | {} | {} | {} | {} | {} | {} |\n",
                col_name, col_type, nullable, key, def, extra, comment
            ));
        }
        md.push('\n');

        // Indexes
        let indexes: Vec<(String, String, Value)> = conn
            .exec(
                r#"SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE
                   FROM INFORMATION_SCHEMA.STATISTICS
                   WHERE TABLE_SCHEMA = :db AND TABLE_NAME = :tbl
                   ORDER BY INDEX_NAME, SEQ_IN_INDEX"#,
                params! { "db" => c.database.clone(), "tbl" => table_name.clone() },
            )
            .map_err(|e| format!("Schema MD indexes failed: {e}"))?;

        if !indexes.is_empty() {
            md.push_str("### Indexes\n\n");
            md.push_str("| Index | Column | Unique |\n|-------|--------|--------|\n");
            for (idx_name, col_name, non_unique) in &indexes {
                let unique = match non_unique {
                    Value::Int(0) | Value::UInt(0) => "Yes",
                    _ => "No",
                };
                md.push_str(&format!("| {} | {} | {} |\n", idx_name, col_name, unique));
            }
            md.push('\n');
        }

        // Foreign keys
        let fks: Vec<(String, String, String, String)> = conn
            .exec(
                r#"SELECT kcu.CONSTRAINT_NAME, kcu.COLUMN_NAME,
                          kcu.REFERENCED_TABLE_NAME, kcu.REFERENCED_COLUMN_NAME
                   FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
                   JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                       ON kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
                       AND kcu.TABLE_SCHEMA = tc.TABLE_SCHEMA
                       AND kcu.TABLE_NAME = tc.TABLE_NAME
                   WHERE kcu.TABLE_SCHEMA = :db AND kcu.TABLE_NAME = :tbl
                       AND tc.CONSTRAINT_TYPE = 'FOREIGN KEY'"#,
                params! { "db" => c.database.clone(), "tbl" => table_name.clone() },
            )
            .map_err(|e| format!("Schema MD FK failed: {e}"))?;

        if !fks.is_empty() {
            md.push_str("### Foreign Keys\n\n");
            md.push_str("| Constraint | Column | References |\n|-----------|--------|------------|\n");
            for (cname, col, ref_table, ref_col) in &fks {
                md.push_str(&format!("| {} | {} | {}.{} |\n", cname, col, ref_table, ref_col));
            }
            md.push('\n');
        }

        // Sample data (3 rows)
        let sample_result = conn.query_iter(
            &format!("SELECT * FROM `{}` LIMIT 3", table_name)
        );
        if let Ok(mut result) = sample_result {
            let sample_cols: Vec<String> = result
                .columns()
                .as_ref()
                .iter()
                .map(|c| c.name_str().to_string())
                .collect();
            let mut sample_rows: Vec<Vec<String>> = Vec::new();
            while let Some(row_result) = result.next() {
                if let Ok(row) = row_result {
                    let vals: Vec<String> = row.unwrap().into_iter().map(mysql_value_to_string).collect();
                    sample_rows.push(vals);
                }
            }
            if !sample_rows.is_empty() {
                md.push_str("### Sample Data\n\n");
                md.push_str(&format!("| {} |\n", sample_cols.join(" | ")));
                md.push_str(&format!("|{}|\n", sample_cols.iter().map(|_| "---").collect::<Vec<_>>().join("|")));
                for row in &sample_rows {
                    let escaped: Vec<String> = row.iter().map(|v| v.replace('|', "\\|")).collect();
                    md.push_str(&format!("| {} |\n", escaped.join(" | ")));
                }
                md.push('\n');
            }
        }
    }

    // Relationships summary
    let all_fks: Vec<(String, String, String, String)> = conn
        .exec(
            r#"SELECT kcu.TABLE_NAME, kcu.COLUMN_NAME,
                      kcu.REFERENCED_TABLE_NAME, kcu.REFERENCED_COLUMN_NAME
               FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
               JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                   ON kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
                   AND kcu.TABLE_SCHEMA = tc.TABLE_SCHEMA
                   AND kcu.TABLE_NAME = tc.TABLE_NAME
               WHERE kcu.TABLE_SCHEMA = :db AND tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
               ORDER BY kcu.TABLE_NAME"#,
            params! { "db" => c.database.clone() },
        )
        .unwrap_or_default();

    if !all_fks.is_empty() {
        md.push_str("## Relationships\n\n");
        for (tbl, col, ref_tbl, ref_col) in &all_fks {
            md.push_str(&format!("- `{}`.`{}` → `{}`.`{}`\n", tbl, col, ref_tbl, ref_col));
        }
        md.push('\n');
    }

    Ok(md)
}

fn pg_generate_schema_md(c: &ConnectionInput) -> Result<String, String> {
    let mut client = open_pg(c)?;
    let mut md = String::new();
    md.push_str(&format!("# Database: {}\n\n", c.database));
    md.push_str(&format!("**Engine:** PostgreSQL\n\n"));

    // Get all tables with row counts
    let tables = client
        .query(
            "SELECT c.relname::text, c.reltuples::bigint \
             FROM pg_class c \
             JOIN pg_namespace n ON n.oid = c.relnamespace \
             WHERE n.nspname = 'public' AND c.relkind = 'r' \
             ORDER BY c.relname",
            &[],
        )
        .map_err(|e| format!("Schema MD tables failed: {e}"))?;

    md.push_str("## Tables Overview\n\n");
    md.push_str("| Table | Approx Rows |\n|-------|------------|\n");
    let table_names: Vec<String> = tables.iter().map(|r| r.get::<_, String>(0)).collect();
    for row in &tables {
        let name: String = row.get(0);
        let rows: i64 = row.get(1);
        md.push_str(&format!("| {} | {} |\n", name, rows));
    }
    md.push('\n');

    for table_name in &table_names {
        md.push_str(&format!("## Table: `{}`\n\n", table_name));

        // Columns
        let cols = client
            .query(
                r#"SELECT c.column_name, c.data_type, c.is_nullable,
                          COALESCE(c.column_default, ''),
                          CASE WHEN pk.column_name IS NOT NULL THEN 'PRI' ELSE '' END as col_key,
                          COALESCE(pgd.description, '') as col_comment
                   FROM information_schema.columns c
                   LEFT JOIN (
                       SELECT kcu.column_name FROM information_schema.table_constraints tc
                       JOIN information_schema.key_column_usage kcu
                           ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
                       WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = $1 AND tc.table_schema = 'public'
                   ) pk ON pk.column_name = c.column_name
                   LEFT JOIN pg_catalog.pg_statio_all_tables psat
                       ON psat.schemaname = c.table_schema AND psat.relname = c.table_name
                   LEFT JOIN pg_catalog.pg_description pgd
                       ON pgd.objoid = psat.relid AND pgd.objsubid = c.ordinal_position
                   WHERE c.table_catalog = $2 AND c.table_schema = 'public' AND c.table_name = $1
                   ORDER BY c.ordinal_position"#,
                &[&table_name.to_string(), &c.database],
            )
            .map_err(|e| format!("Schema MD columns failed: {e}"))?;

        md.push_str("### Columns\n\n");
        md.push_str("| Column | Type | Nullable | Key | Default | Comment |\n");
        md.push_str("|--------|------|----------|-----|---------|--------|\n");
        for row in &cols {
            let col_name: String = row.get(0);
            let col_type: String = row.get(1);
            let nullable: String = row.get(2);
            let default_val: String = row.get(3);
            let key: String = row.get(4);
            let comment: String = row.get(5);
            md.push_str(&format!(
                "| {} | {} | {} | {} | {} | {} |\n",
                col_name, col_type, nullable, key, default_val, comment
            ));
        }
        md.push('\n');

        // Indexes
        let indexes = client
            .query(
                "SELECT indexname::text, indexdef::text FROM pg_indexes \
                 WHERE schemaname = 'public' AND tablename = $1 ORDER BY indexname",
                &[&table_name.to_string()],
            )
            .map_err(|e| format!("Schema MD indexes failed: {e}"))?;

        if !indexes.is_empty() {
            md.push_str("### Indexes\n\n");
            md.push_str("| Index | Definition |\n|-------|------------|\n");
            for row in &indexes {
                let name: String = row.get(0);
                let def: String = row.get(1);
                md.push_str(&format!("| {} | {} |\n", name, def.replace('|', "\\|")));
            }
            md.push('\n');
        }

        // Foreign keys
        let fks = client
            .query(
                r#"SELECT tc.constraint_name, kcu.column_name,
                          ccu.table_name AS ref_table, ccu.column_name AS ref_col
                   FROM information_schema.table_constraints tc
                   JOIN information_schema.key_column_usage kcu
                       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
                   JOIN information_schema.constraint_column_usage ccu
                       ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
                   WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1 AND tc.table_schema = 'public'"#,
                &[&table_name.to_string()],
            )
            .map_err(|e| format!("Schema MD FK failed: {e}"))?;

        if !fks.is_empty() {
            md.push_str("### Foreign Keys\n\n");
            md.push_str("| Constraint | Column | References |\n|-----------|--------|------------|\n");
            for row in &fks {
                let cname: String = row.get(0);
                let col: String = row.get(1);
                let ref_tbl: String = row.get(2);
                let ref_col: String = row.get(3);
                md.push_str(&format!("| {} | {} | {}.{} |\n", cname, col, ref_tbl, ref_col));
            }
            md.push('\n');
        }

        // Sample data (3 rows)
        let sample_query = format!("SELECT * FROM \"{}\" LIMIT 3", table_name);
        if let Ok(sample_rows) = client.query(&sample_query, &[]) {
            if !sample_rows.is_empty() {
                let sample_cols: Vec<String> = sample_rows[0]
                    .columns()
                    .iter()
                    .map(|c| c.name().to_string())
                    .collect();

                md.push_str("### Sample Data\n\n");
                md.push_str(&format!("| {} |\n", sample_cols.join(" | ")));
                md.push_str(&format!("|{}|\n", sample_cols.iter().map(|_| "---").collect::<Vec<_>>().join("|")));
                for row in &sample_rows {
                    let vals: Vec<String> = (0..row.len())
                        .map(|i| {
                            let val = pg_value_to_string(row, i, row.columns()[i].type_());
                            val.replace('|', "\\|")
                        })
                        .collect();
                    md.push_str(&format!("| {} |\n", vals.join(" | ")));
                }
                md.push('\n');
            }
        }
    }

    Ok(md)
}

#[tauri::command]
fn generate_schema_md(connection: ConnectionInput) -> Result<String, String> {
    match connection.db_type.as_str() {
        "mysql" => mysql_generate_schema_md(&connection),
        "postgres" => pg_generate_schema_md(&connection),
        other => Err(format!("Unsupported database type: {other}")),
    }
}

// ── AI Chat types & command ───────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiChatRequest {
    base_url: String,
    api_key: String,
    model: String,
    messages: Vec<AiChatMessage>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct AiChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct OpenAiResponse {
    choices: Vec<OpenAiChoice>,
}

#[derive(Debug, Deserialize)]
struct OpenAiChoice {
    message: OpenAiMessage,
}

#[derive(Debug, Deserialize)]
struct OpenAiMessage {
    content: String,
}

#[tauri::command]
async fn ai_chat(request: AiChatRequest) -> Result<String, String> {
    // Run the HTTP request on a background thread so the UI stays responsive
    tokio::task::spawn_blocking(move || {
        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .connect_timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| format!("HTTP client init failed: {e}"))?;

        let url = format!(
            "{}/chat/completions",
            request.base_url.trim_end_matches('/')
        );

        let body = serde_json::json!({
            "model": request.model,
            "messages": request.messages,
            "temperature": 0.2,
        });

        let mut req_builder = client
            .post(&url)
            .header("Content-Type", "application/json");

        if !request.api_key.is_empty() {
            req_builder =
                req_builder.header("Authorization", format!("Bearer {}", request.api_key));
        }

        let resp = req_builder
            .json(&body)
            .send()
            .map_err(|e| format!("API request failed: {e}"))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body_text = resp.text().unwrap_or_default();

            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&body_text) {
                if let Some(msg) = parsed["error"]["message"].as_str() {
                    return Err(format!("{msg}"));
                }
            }

            return Err(format!("API error {status}: {body_text}"));
        }

        let parsed: OpenAiResponse = resp
            .json()
            .map_err(|e| format!("Failed to parse API response: {e}"))?;

        parsed
            .choices
            .first()
            .map(|c| c.message.content.clone())
            .ok_or_else(|| "No response from AI model".to_string())
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}

// ── Table Info ────────────────────────────────────────────────────────────────

#[tauri::command]
fn get_table_info(connection: ConnectionInput, table: String) -> Result<TableInfo, String> {
    match connection.db_type.as_str() {
        "mysql" => {
            let mut conn = open_mysql(&connection)?;
            let row: Option<(
                Option<String>, Option<u64>, Option<u64>, Option<u64>,
                Option<u64>, Option<String>, Option<String>, Option<String>, Option<String>,
            )> = conn
                .exec_first(
                    "SELECT ENGINE, TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH, AUTO_INCREMENT, \
                     CREATE_TIME, UPDATE_TIME, TABLE_COLLATION, TABLE_COMMENT \
                     FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = :db AND TABLE_NAME = :tbl",
                    params! { "db" => connection.database.clone(), "tbl" => table },
                )
                .map_err(|e| format!("Table info failed: {e}"))?;

            match row {
                Some((engine, rows, data_len, idx_len, auto_inc, created, updated, collation, comment)) => {
                    Ok(TableInfo {
                        engine: engine.unwrap_or_default(),
                        row_count: rows.unwrap_or(0) as i64,
                        data_size: format_bytes(data_len.unwrap_or(0)),
                        index_size: format_bytes(idx_len.unwrap_or(0)),
                        auto_increment: auto_inc.map(|v| v.to_string()).unwrap_or_else(|| "—".into()),
                        create_time: created.unwrap_or_else(|| "—".into()),
                        update_time: updated.unwrap_or_else(|| "—".into()),
                        collation: collation.unwrap_or_default(),
                        comment: comment.unwrap_or_default(),
                    })
                }
                None => Err("Table not found".into()),
            }
        }
        "postgres" => {
            let mut client = open_pg(&connection)?;
            let rows = client
                .query(
                    "SELECT \
                        pg_size_pretty(pg_total_relation_size(c.oid)) as total_size, \
                        c.reltuples::bigint as row_estimate, \
                        pg_size_pretty(pg_table_size(c.oid)) as data_size, \
                        pg_size_pretty(pg_indexes_size(c.oid)) as index_size, \
                        obj_description(c.oid) as comment \
                     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace \
                     WHERE n.nspname = 'public' AND c.relname = $1",
                    &[&table],
                )
                .map_err(|e| format!("Table info failed: {e}"))?;

            if let Some(row) = rows.first() {
                let total_size: String = row.get(0);
                let row_count: i64 = row.get(1);
                let data_size: String = row.get(2);
                let index_size: String = row.get(3);
                let comment: Option<String> = row.get(4);
                Ok(TableInfo {
                    engine: "PostgreSQL".into(),
                    row_count,
                    data_size: format!("{data_size} (total: {total_size})"),
                    index_size,
                    auto_increment: "—".into(),
                    create_time: "—".into(),
                    update_time: "—".into(),
                    collation: "—".into(),
                    comment: comment.unwrap_or_default(),
                })
            } else {
                Err("Table not found".into())
            }
        }
        other => Err(format!("Unsupported database type: {other}")),
    }
}

fn format_bytes(bytes: u64) -> String {
    if bytes >= 1_073_741_824 {
        format!("{:.1} GB", bytes as f64 / 1_073_741_824.0)
    } else if bytes >= 1_048_576 {
        format!("{:.1} MB", bytes as f64 / 1_048_576.0)
    } else if bytes >= 1024 {
        format!("{:.1} KB", bytes as f64 / 1024.0)
    } else {
        format!("{bytes} B")
    }
}

// ── Table Triggers ───────────────────────────────────────────────────────────

#[tauri::command]
fn get_table_triggers(connection: ConnectionInput, table: String) -> Result<Vec<TriggerInfo>, String> {
    match connection.db_type.as_str() {
        "mysql" => {
            let mut conn = open_mysql(&connection)?;
            let rows: Vec<(String, String, String, String)> = conn
                .exec(
                    "SELECT TRIGGER_NAME, EVENT_MANIPULATION, ACTION_TIMING, ACTION_STATEMENT \
                     FROM INFORMATION_SCHEMA.TRIGGERS \
                     WHERE TRIGGER_SCHEMA = :db AND EVENT_OBJECT_TABLE = :tbl \
                     ORDER BY TRIGGER_NAME",
                    params! { "db" => connection.database.clone(), "tbl" => table },
                )
                .map_err(|e| format!("Triggers query failed: {e}"))?;

            Ok(rows.into_iter().map(|(name, event, timing, stmt)| TriggerInfo {
                trigger_name: name,
                event,
                timing,
                statement: stmt,
            }).collect())
        }
        "postgres" => {
            let mut client = open_pg(&connection)?;
            let rows = client
                .query(
                    "SELECT t.tgname, \
                            CASE WHEN t.tgtype & 4 = 4 THEN 'INSERT' \
                                 WHEN t.tgtype & 8 = 8 THEN 'DELETE' \
                                 WHEN t.tgtype & 16 = 16 THEN 'UPDATE' \
                                 ELSE 'UNKNOWN' END as event, \
                            CASE WHEN t.tgtype & 2 = 2 THEN 'BEFORE' ELSE 'AFTER' END as timing, \
                            pg_get_triggerdef(t.oid) as definition \
                     FROM pg_trigger t \
                     JOIN pg_class c ON c.oid = t.tgrelid \
                     JOIN pg_namespace n ON n.oid = c.relnamespace \
                     WHERE n.nspname = 'public' AND c.relname = $1 AND NOT t.tgisinternal \
                     ORDER BY t.tgname",
                    &[&table],
                )
                .map_err(|e| format!("Triggers query failed: {e}"))?;

            Ok(rows.iter().map(|r| TriggerInfo {
                trigger_name: r.get(0),
                event: r.get(1),
                timing: r.get(2),
                statement: r.get(3),
            }).collect())
        }
        other => Err(format!("Unsupported database type: {other}")),
    }
}

// ── List Databases ───────────────────────────────────────────────────────────

#[tauri::command]
fn list_databases(connection: ConnectionInput) -> Result<Vec<String>, String> {
    match connection.db_type.as_str() {
        "mysql" => {
            let mut conn = open_mysql(&connection)?;
            let dbs: Vec<String> = conn
                .query("SHOW DATABASES")
                .map_err(|e| format!("List databases failed: {e}"))?;
            Ok(dbs)
        }
        "postgres" => {
            let mut client = open_pg(&connection)?;
            let rows = client
                .query("SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname", &[])
                .map_err(|e| format!("List databases failed: {e}"))?;
            Ok(rows.iter().map(|r| r.get(0)).collect())
        }
        other => Err(format!("Unsupported database type: {other}")),
    }
}

// ── Primary Keys ─────────────────────────────────────────────────────────────

#[tauri::command]
fn get_primary_keys(
    connection: ConnectionInput,
    table: String,
) -> Result<Vec<String>, String> {
    match connection.db_type.as_str() {
        "mysql" => {
            let mut conn = open_mysql(&connection)?;
            let rows: Vec<String> = conn
                .exec(
                    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE \
                     WHERE TABLE_SCHEMA = :db AND TABLE_NAME = :tbl AND CONSTRAINT_NAME = 'PRIMARY' \
                     ORDER BY ORDINAL_POSITION",
                    params! { "db" => &connection.database, "tbl" => &table },
                )
                .map_err(|e| format!("Get primary keys failed: {e}"))?;
            Ok(rows)
        }
        "postgres" => {
            let mut client = open_pg(&connection)?;
            let rows = client
                .query(
                    "SELECT a.attname \
                     FROM pg_index i \
                     JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) \
                     WHERE i.indrelid = $1::regclass AND i.indprimary \
                     ORDER BY array_position(i.indkey, a.attnum)",
                    &[&table],
                )
                .map_err(|e| format!("Get primary keys failed: {e}"))?;
            Ok(rows.iter().map(|r| r.get(0)).collect())
        }
        other => Err(format!("Unsupported database type: {other}")),
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            test_connection,
            load_schema,
            run_query,
            get_table_structure,
            get_table_relations,
            save_app_data,
            load_app_data,
            ai_chat,
            get_table_row_counts,
            generate_schema_md,
            get_table_info,
            get_table_triggers,
            list_databases,
            get_primary_keys
        ])
        .run(tauri::generate_context!())
        .expect("failed to run app");
}
