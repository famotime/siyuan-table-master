# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

```bash
pnpm install            # Install dependencies
npm run build           # Production build → ./dist/ + ./package.zip
npm run dev             # Watch mode, auto-copies to SiYuan workspace (requires .env)
npm test                # Run all tests (vitest, 74 tests)
npm run test:watch      # Watch mode for tests
npm run release         # Interactive version bump + git tag + push
npm run release:patch   # Auto patch bump
npx eslint src/         # Lint
```

- For dev mode, set `VITE_SIYUAN_WORKSPACE_PATH` in `.env` pointing to your SiYuan workspace
- After rebuilding, reload the plugin in SiYuan (disable/re-enable or restart)

## Project Architecture

SiYuan note plugin that enhances NodeTable blocks with advanced editing. Reuses `@tgrosinger/md-advanced-tables` core library (from Obsidian) via a SiYuan adapter.

### Data Flow (single operation)

```
Command/Key → commands.ts → SiyuanTextEditor → TableEditor → core library
                                 (reload)         (flush)
GET /api/block/getBlockKramdown            POST /api/block/updateBlock(markdown)
```

### Key Files

| File | Role |
|---|---|
| `src/index.ts` | Plugin entry — `AdvancedTablesPlugin extends Plugin`, loads settings, registers commands, keybinds |
| `src/commands.ts` | 20+ table commands (nav, format, insert/delete, sort, align, formulas, escape) |
| `src/table-editor.ts` | Facade wrapping core library's `TableEditor` |
| `src/siyuan-text-editor.ts` | **Core adapter** — implements `ITextEditor` via in-memory line model, reads kramdown from kernel API, writes back with `updateBlock` |
| `src/dom-utils.ts` | DOM helpers: find table block, map Range ↔ (row, col) coordinates |
| `src/table-model.ts` | Pure functions: kramdown ↔ line arrays, CJK display width utilities |
| `src/keybind.ts` | Capture-phase keydown listener for Tab/Enter interception |
| `src/settings.ts` | PluginSettings interface, load/save via `plugin.loadData/saveData` |

### Architecture Decisions

- **Write path**: `/api/block/updateBlock` (kernel API with markdown data type) — more reliable than `protyle.updateTransactionElement`. Undo handled at adapter level.
- **Cursor mapping**: kramdown text offset (approximate), recovery goes to cell start by default.
- **Asynchrony absorption**: `SiyuanTextEditor` pre-loads all lines into memory on `reload()`, operates synchronously, flushes with one async write.
- **Keyboard interception**: DOM capture-phase listener catches Tab/Enter before SiYuan's default handlers.

### Line Model Mapping

```
DOM: thead > tr[0] (header) → Core lib: Row 0
DOM: tbody > tr[0] (data 1) → Core lib: Row 2 (separator at Row 1 skipped)
```

Kramdown IAL (`{: id="..."}`) is managed separately by the adapter.

### Tests

- `__tests__/table-model.test.ts` (29 tests) — pure function unit tests
- `__tests__/core-library.test.ts` (21 tests) — core lib integration with `InMemoryTextEditor` fixture
- `__tests__/kramdown-roundtrip.test.ts` (24 tests) — round-trip with SiYuan-style kramdown
- `__tests__/helpers/InMemoryTextEditor.ts` — test double for `ITextEditor`

### Settings

- `formatType`: `WEAK` (default) / `NORMAL`
- `bindTab`: Tab navigation (default: true)
- `bindEnter`: Enter next-row (default: true)
- `fixCJKWidth`: CJK correction for NORMAL format (default: true)
- `showTopBarIcon` (default: true)
