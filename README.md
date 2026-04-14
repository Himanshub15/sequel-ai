<p align="center">
  <img src="src-tauri/icons/icon.svg" width="128" height="128" alt="Sequel AI Logo" />
</p>

<h1 align="center">Sequel AI</h1>

<p align="center">
  <strong>A native SQL editor with built-in AI — inspired by Sequel Pro, powered by Rust.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/MySQL-4479A1?style=flat-square&logo=mysql&logoColor=white" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/Tauri_2.0-24C8D8?style=flat-square&logo=tauri&logoColor=white" />
  <img src="https://img.shields.io/badge/React_18-61DAFB?style=flat-square&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/Rust-000000?style=flat-square&logo=rust&logoColor=white" />
  <img src="https://img.shields.io/badge/AI_Powered-FF6B6B?style=flat-square&logo=openai&logoColor=white" />
</p>

---

## What is this?

Sequel AI is a lightweight, native desktop SQL editor inspired by [Sequel Pro](https://www.sequelpro.com/) — with a built-in AI assistant that understands your schema. Built with **Tauri 2.0 + React + Rust**, it launches instantly, connects fast, and writes SQL for you.

No Electron. No 500MB RAM. Just a fast, native tool with AI superpowers.

## Features

### Database Client
- **Multi-database** — MySQL & PostgreSQL, switch with one click
- **Favorites** — Save, name, and color-code your connections (double-click to connect)
- **Multi-tab connections** — `Cmd+T` to open a new connection tab, work across databases simultaneously
- **Database selector** — Switch between databases without reconnecting
- **6-view workspace** — Content, Structure, Relations, Table Info, Query, and Triggers
- **Categorized sidebar** — Tables, Views, Stored Procedures, and Functions with collapsible sections
- **Table structure inspector** — Column types, keys, defaults, extras, and comments
- **Foreign key relations** — See how your tables are connected
- **Table info** — Engine, row count, data size, collation, and more
- **Triggers view** — Browse triggers with expandable SQL statements
- **Query editor** — SQL syntax highlighting, line numbers, `Cmd+Enter` to run
- **Data grid** — Fast table rendering with row numbers, null highlighting, alternating rows
- **Content filters** — Add WHERE conditions to filter table data without writing SQL
- **Inline editing** — Double-click any cell to edit, auto-saves via UPDATE (primary key aware)
- **Export** — One-click CSV or JSON export from content view and query results
- **Query favorites** — Save and name your go-to queries for quick access
- **Query history** — Browse past queries with execution time, row count, and status
- **Dark mode** — Light and dark themes with persistent toggle
- **Schema tools** — Create table templates, one-click schema refresh
- **Persistence** — Favorites, table comments, theme, and AI settings survive restarts
- **Color-coded connections** — 5 colors to visually distinguish dev, staging, and prod

### AI Assistant
- **Natural language to SQL** — Describe what you want, get the query
- **Schema-aware** — Auto-generates Markdown context from your tables, columns, types, and keys
- **Resizable AI panel** — Drag to resize, stays open across tab switches
- **Multiple providers** — OpenAI, Ollama (local), Groq, NVIDIA NIM, or any OpenAI-compatible API
- **Non-blocking** — AI requests run async, the app stays responsive
- **SQL-focused** — Trained on your schema context for accurate queries

```
"Give me max salary from employees where joining date > 2025 June 1st"
```
↓
```sql
SELECT MAX(salary) FROM employees WHERE joining_date > '2025-06-01';
```

## Stack

| Layer | Tech |
|-------|------|
| **Desktop runtime** | Tauri 2.0 |
| **Backend** | Rust (`mysql` + `postgres` + `reqwest` crates) |
| **Frontend** | React 18 + TypeScript |
| **Build** | Vite |
| **Styling** | Vanilla CSS (zero dependencies) |

Total dependencies: minimal. App size: ~15MB.

## Quick Start

**Prerequisites:** Node.js 20+, Rust toolchain, MySQL/PostgreSQL running locally.

```bash
# Clone & install
git clone https://github.com/Himanshub15/sequel-ai.git
cd sequel-ai
npm install

# Launch
npm run tauri dev
```

Connect to `127.0.0.1:3306` with your credentials and go. Open the AI panel, configure your provider, and start asking questions in plain English.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd + Enter` | Run query |
| `Cmd + T` | New connection tab |
| `Cmd + W` | Close current tab |
| `Cmd + 1-6` | Switch workspace views |
| `Tab` | Insert 2 spaces in editor |
| `Double-click cell` | Inline edit (content view) |
| `Enter` | Save cell edit |
| `Escape` | Cancel cell edit |

## Roadmap

### Phase 1 — Core Editor ✅
- [x] MySQL + PostgreSQL connections
- [x] Favorites system with color coding
- [x] Multi-tab connections
- [x] Content, Structure, Relations, Query views
- [x] Table comments & persistence
- [x] Schema refresh

### Phase 2 — AI Integration ✅
- [x] AI chat panel with schema context
- [x] OpenAI, Ollama, Groq, NVIDIA NIM support
- [x] Resizable AI panel
- [x] Categorized sidebar (Tables, Views, Procedures, Functions)
- [x] Table Info & Triggers views
- [x] Database selector
- [x] Double-click favorites to connect
- [x] Async AI (non-blocking UI)

### Phase 3 — Power Features ✅
- [x] Content view filters (WHERE clause builder with multiple conditions)
- [x] Inline cell editing (double-click to edit, auto-detects primary keys)
- [x] Query favorites (save, name, and quick-access your go-to queries)
- [x] Query history with execution stats
- [x] Export results (CSV & JSON from content view and query results)
- [x] Dark mode with persistent theme toggle

### Phase 4 — Coming Next 🚧
- [ ] Bundled local LLM (offline AI via llama.cpp)
- [ ] SSH tunnel connections
- [ ] SQLite support
- [ ] Query auto-complete

---

<p align="center">
  <sub>Built with Tauri, React, and Rust. Designed to feel native because it is.</sub>
</p>
