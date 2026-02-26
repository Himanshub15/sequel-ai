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

    Ok(DatabaseSchema {
        database: c.database.clone(),
        tables,
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

    Ok(DatabaseSchema {
        database: c.database.clone(),
        tables,
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
            load_app_data
        ])
        .run(tauri::generate_context!())
        .expect("failed to run app");
}
