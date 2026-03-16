# SQL Studio (SequAI) — Project Memory

## Repo & Location
- **GitHub**: https://github.com/Himanshub15/SequAI
- **Local path**: ~/Desktop/sql editor/
- **App name**: SQL Studio (will become SequAI with AI features)

## Tech Stack
- **Tauri 2.0** (desktop runtime)
- **Rust** backend: `mysql` crate v25, `postgres` crate v0.19, `chrono` v0.4
- **React 18 + TypeScript** frontend
- **Vite** build tool
- **Vanilla CSS** (zero UI library dependencies)
- Light theme inspired by Sequel Pro

## Project Architecture
- **Two-page flow**: HomePage (connection screen) → WorkspacePage (database view)
- **Multi-connection tabs**: Each tab holds independent ConnectionTab state
- **State-based routing** in App.tsx (no React Router)
- **Tauri invoke API**: `invoke<T>("command_name", { params })` for frontend→backend

## Rust Backend Commands (7 total)
1. `test_connection` — ping database
2. `load_schema` — get all tables + columns
3. `run_query` — execute SQL, return results
4. `get_table_structure` — INFORMATION_SCHEMA column details
5. `get_table_relations` — foreign key relationships
6. `save_app_data` — JSON persistence to app_data_dir
7. `load_app_data` — read persisted JSON

## Key Files
- `src-tauri/src/main.rs` — all Rust backend (~600 lines)
- `src/App.tsx` — multi-tab orchestrator
- `src/types.ts` — all TypeScript types (~120 lines)
- `src/styles.css` — complete CSS (~1050 lines)
- `src/components/` — HomePage, WorkspacePage, ConnectionTabBar, Toolbar, TableList, ContentView, StructureView, RelationsView, Editor, ResultPanel, StatusBar
- `src/hooks/` — useAppData, useFavorites, useTableComments, useKeyboardShortcuts

## Phase 1 Features (Complete)
- MySQL + PostgreSQL support
- Favorites system with persistence
- Color-coded connections (5 colors: blue, green, red, orange, purple)
- Connection naming
- Standard / Socket / SSH connection types (SSH = UI only placeholder)
- Multi-connection tabs (Cmd+T / Cmd+W)
- 4-view workspace: Content, Structure, Relations, Query
- Table comments with persistence
- Create table template (+ button in status bar)
- Schema refresh (↻ button in status bar)
- Query editor with line numbers, Cmd+Enter to run

## Phase 2 (AI Plugin — Next)
- Natural language to SQL inside the query editor
- User's example: "Give me max salary from employees where joining date > 2025 June 1st" → SQL
- Planned providers: Ollama (local), OpenAI-compatible APIs (bring your own key)

## Local MySQL Setup
- Host: 127.0.0.1, Port: 3306
- User: root, Password: root
- Database: `sql_studio_demo`
- Tables: employees, products, orders, transactions (1000 rows each)

## Dev Commands
- `npm run tauri dev` — launch app (port 1420)
- Need `export PATH="/opt/homebrew/bin:$HOME/.cargo/bin:$PATH"` for node/cargo
- Kill port if stuck: `lsof -ti:1420 | xargs kill -9`

## Git
- Remote: HTTPS (not SSH — SSH keys not set up)
- Auth: GitHub CLI (`gh`) installed via Homebrew
- Branch: main

## Design Preferences
- User rejected dark DataGrip-style design, prefers Sequel Pro light theme
- Clean home page for connection, then database workspace view
- Minimal dependencies, no UI libraries
