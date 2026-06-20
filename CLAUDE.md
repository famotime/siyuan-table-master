# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

```bash
pnpm install            # Install dependencies
npm run build           # Production build → ./dist/ + ./package.zip
npm run dev             # Watch mode, auto-copies to SiYuan workspace (requires .env)
npm test                # Run all tests (vitest, 103 tests)
npm run test:watch      # Watch mode for tests
npm run release         # Interactive version bump + git tag + push
npm run release:patch   # Auto patch bump
npx eslint src/         # Lint (ESLint config currently broken due to missing i18n plugin)
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
| `src/index.ts` | Plugin entry — `AdvancedTablesPlugin extends Plugin`, loads settings, registers commands, keybinds, sub-modules |
| `src/commands.ts` | 20+ table command definitions + `registerCommands` / `executeCommand` dispatcher |
| `src/text-to-table.ts` | Text-to-table UI logic — `executeTextToTable` + `showTextToTableDialog` (depends on siyuan runtime) |
| `src/text-to-table-utils.ts` | Text-to-table pure functions — `parseLines`, `isBoxDrawingTable`, `gridToMarkdown` (unit-testable) |
| `src/table-editor.ts` | Facade wrapping core library's `TableEditor` + copy/paste/sum operations |
| `src/siyuan-text-editor.ts` | **Core adapter** — implements `ITextEditor` via in-memory line model, reads kramdown from kernel API, writes back with `updateBlock`. Also exposes `getLineCount/getLineAt/setLineAt/insertLineAt/removeLine/markDirty` for external modules |
| `src/dom-utils.ts` | DOM helpers: find table block, Range ↔ (row, col) mapping, `highlightActiveRowAndCol`, `escapeHtml`, `getCellCoordFromTable` |
| `src/table-model.ts` | Pure functions: kramdown ↔ line arrays, CJK display width utilities |
| `src/keybind.ts` | Capture-phase keydown listener for Tab/Enter interception |
| `src/settings.ts` | PluginSettings interface, load/save via `plugin.loadData/saveData` |
| `src/dock.ts` | Side-panel toolbox — status detection, button grid, tooltip bar |
| `src/floating-toolbar.ts` | Floating toolbar — follows cursor, re-positions on scroll/resize |
| `src/smart-paste.ts` | Smart paste — HTML/TSV parsing → grid → table fill |
| `src/quick-calc.ts` | Quick calculation — Alt+drag selection, sum/average/count bar |
| `src/drag-reorder.ts` | Drag reorder — row/col drag handles + indicator line + cursor tracking |
| `src/confirm-dialog.ts` | Paste override confirmation dialog |
| `src/utils/index.ts` | Shared utility re-exports (`escapeHtml`, `getCellCoordFromTable`, `parseLines`, `gridToMarkdown`) |

### Architecture Decisions

- **Write path**: `/api/block/updateBlock` (kernel API with markdown data type) — more reliable than `protyle.updateTransactionElement`. Undo handled at adapter level.
- **Cursor mapping**: kramdown text offset (approximate), recovery goes to cell start by default.
- **Asynchrony absorption**: `SiyuanTextEditor` pre-loads all lines into memory on `reload()`, operates synchronously, flushes with one async write.
- **Keyboard interception**: DOM capture-phase listener catches Tab/Enter before SiYuan's default handlers.
- **Adapter encapsulation**: External modules (smart-paste, drag-reorder) access the line model through public methods (`getLineCount`, `getLineAt`, `setLineAt`, `insertLineAt`, `removeLine`, `markDirty`) — never via `(ctx as any)._lines`.

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
- `__tests__/text-to-table.test.ts` (20 tests) — text-to-table pure functions (parseLines, escapeHtml, gridToMarkdown, isBoxDrawingTable)
- `__tests__/dom-utils.test.ts` (5 tests) — dom-utils pure functions (escapeHtml, getCellCoordFromTable)
- `__tests__/helpers/InMemoryTextEditor.ts` — test double for `ITextEditor`
- **Total: 103 tests**

### Settings

- `formatType`: `WEAK` (default) / `NORMAL`
- `showFloatingToolbar`: show floating toolbar when cursor in table (default: true)
- `enableStickyHeader`: sticky table header (default: true)
- `enableSmartPaste`: smart clipboard paste (default: true)
- `enableQuickCalc`: Alt+drag selection calc (default: true)
- `enableDragReorder`: drag row/col reorder (default: true)
- `bindTab`: Tab navigation (default: true)
- `bindEnter`: Enter next-row (default: true)
- `fixCJKWidth`: CJK width correction (default: true)
- `showTopBarIcon` (default: true)
