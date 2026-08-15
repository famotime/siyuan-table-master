# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

```bash
pnpm install            # Install dependencies
npm run build           # Production build → ./dist/ + ./package.zip
npm run dev             # Watch mode, auto-copies to SiYuan workspace (requires .env)
npm test                # Run all tests (vitest, 183 tests across 14 suites)
npm run test:watch      # Watch mode for tests
npm run release         # Interactive version bump + git tag + push
npm run release:patch   # Auto patch bump
```

- For dev mode, set `VITE_SIYUAN_WORKSPACE_PATH` in `.env` pointing to your SiYuan workspace plugin directory.
- After rebuilding, reload the plugin inside SiYuan (disable/re-enable or restart).

## Project Architecture

SiYuan note plugin (v1.1.5) that provides advanced table capabilities across two tracks:
1. **Markdown Tables (`NodeTable`)**: Enhances native tables using `@tgrosinger/md-advanced-tables` core via a custom SiYuan `ITextEditor` adapter. Supports cell navigation, formatting, formulas/sum, drag reordering, charting, database conversion, and CSV/XLSX export.
2. **HTML Complex Tables (`NodeHTMLBlock`)**: Full visual dialog editor supporting merged cells (`rowspan`/`colspan`), typography/borders/colors styling, and converting HTML tables back to native Markdown tables.

### Data Flow

```
[Markdown Operation]
Command / Key / UI → commands.ts → SiyuanTextEditor → TableEditor → md-advanced-tables core
                                          ↑ (reload)                         ↓ (flush)
                                  GET /api/block/getBlockKramdown    POST /api/block/updateBlock

[HTML Table Edit / Conversion]
HtmlFloatingToolbar / Dock → HtmlDialogEditor → HtmlTableEditor → POST /api/block/updateBlock
                                      ↳ HtmlToMd → Native NodeTable block
```

## Key Files & Modules

| Area | File | Role |
|---|---|---|
| **Core & Lifecycle** | `src/index.ts` | Plugin entry point, registers commands, dock, toolbars, event listeners, and settings |
| | `src/siyuan-text-editor.ts` | `ITextEditor` adapter: manages in-memory line model, syncs with kernel API, exposes line manipulation APIs |
| | `src/table-editor.ts` | Facade wrapping core library's `TableEditor` + calculation, paste, split, and sum operations |
| | `src/table-model.ts` | Pure functions: Kramdown ↔ 2D row matrix, separator line detection, CJK width calculation |
| | `src/commands.ts` | Table commands registration and execution dispatch |
| **Interactive UI** | `src/dock.ts` | Right dock toolbox (actions, alignment, formatting, charts, DB, exports, samples) |
| | `src/floating-toolbar.ts` | Cursor-following floating toolbar for Markdown tables |
| | `src/drag-reorder.ts` | Row/column drag-and-drop handles and reorder logic |
| | `src/quick-calc.ts` | Alt+drag multi-cell selection quick calculation (sum, avg, count; supports commas and percentages) |
| | `src/smart-paste.ts` | Smart clipboard HTML/TSV parsing and grid pasting |
| | `src/dom-utils.ts` | DOM helpers: table block lookup, Range ↔ cell coordinate mapping, highlight rows/cols |
| **HTML Tables** | `src/html-dialog-editor.ts` | Visual dialog for complex HTML tables (cell merging, alignment, borders, padding, styling, undo/redo) |
| | `src/html-floating-toolbar.ts`| Floating button above HTML tables to trigger visual editor |
| | `src/html-table-editor.ts` | HTML block DOM/kramdown loader and updater |
| | `src/html-to-md.ts` | Pure function / DOM converter from HTML table to native Markdown table |
| | `src/html-commands.ts` | HTML table shortcut commands |
| **Extensions** | `src/table-to-db-dialog.ts` | Markdown table to SiYuan Database / Attribute View (AV) configuration dialog |
| | `src/table-to-db-utils.ts` | Pure functions: smart column type inference (text, number, date, select, checkbox, url) |
| | `src/table-to-chart.ts` | Generates ECharts chart code block from table data |
| | `src/table-export.ts` | Export table to CSV / XLSX with markdown formatting stripped |
| | `src/text-to-table.ts` | Text-to-table UI dialog |
| | `src/text-to-table-utils.ts` | Text-to-table parser (TSV, CSV, box-drawing, space-aligned) |
| | `src/sample-tables.ts` | Predefined sample Markdown and HTML tables |
| **Infrastructure** | `src/settings.ts` | `PluginSettings` interface, load/save/clear config |
| | `src/logger.ts` | Unified logging utility with toggle support |
| | `src/confirm-dialog.ts` | Generic confirmation dialog modal |

## Architecture Decisions & Constraints

- **Write path**: Kernel API `POST /api/block/updateBlock` with markdown data type.
- **Asynchrony Absorption**: `SiyuanTextEditor` preloads lines in memory via `reload()`, executes table operations synchronously, and flushes with a single write on `flush()`.
- **Adapter Encapsulation**: External modules access line data through public methods (`getLineCount`, `getLineAt`, `setLineAt`, `insertLineAt`, `removeLine`, `markDirty`) — never access `(ctx as any)._lines`.
- **Line Model Mapping**:
  - `_lines[0]` = Header row
  - `_lines[1]` = Separator row (`| :--- | ---: |`)
  - `_lines[2+]` = Data rows
  - Block IAL (`{: id="..."}`) is tracked and preserved separately.
- **Testability**: Pure transformations are strictly isolated in `*-utils.ts`, `table-model.ts`, `html-to-md.ts`, and `table-export.ts` without browser/SiYuan API dependencies to enable comprehensive Vitest testing.

## Settings (`PluginSettings`)

- `formatType`: `WEAK` (default, no extra padding) / `NORMAL`
- `fixCJKWidth`: CJK character display width correction (default: `true`)
- `showTopBarIcon`: Show settings icon in SiYuan top bar (default: `true`)
- `showFloatingToolbar`: Show floating toolbar for Markdown tables (default: `true`)
- `enableSmartPaste`: Smart clipboard paste (default: `true`)
- `enableQuickCalc`: Alt+drag selection quick calc (default: `true`)
- `enableDragReorder`: Drag handles for row/col reordering (default: `false`)
- `enableLog`: Console debugging logs output (default: `false`)

## Tests (184 total across 14 suites)

All unit tests run via `npm test`:
- `__tests__/table-model.test.ts` (33)
- `__tests__/kramdown-roundtrip.test.ts` (32)
- `__tests__/text-to-table.test.ts` (25)
- `__tests__/core-library.test.ts` (21)
- `__tests__/html-to-md.test.ts` (13)
- `__tests__/quick-calc.test.ts` (12)
- `__tests__/sum-cells.test.ts` (10)
- `__tests__/table-to-db-utils.test.ts` (9)
- `__tests__/clipboard-operations.test.ts` (7)
- `__tests__/table-export.test.ts` (7)
- `__tests__/split-all-cells.test.ts` (6)
- `__tests__/dom-utils.test.ts` (5)
- `__tests__/resize-table.test.ts` (2)
- `__tests__/settings.test.ts` (2)
