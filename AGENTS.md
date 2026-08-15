# AGENTS.md

Project overview and technical guidelines for AI coding agents.

## Build & Test

```bash
pnpm install            # Install dependencies
npm run build           # Production build → ./dist/ + ./package.zip
npm run dev             # Watch mode (requires VITE_SIYUAN_WORKSPACE_PATH in .env)
npm test                # Run all 223 tests (vitest)
npm run test:watch      # Watch mode for tests
npm run release         # Interactive release bump + tag
```

## Architecture

SiYuan Note plugin (v1.1.6) providing dual table editing capabilities:
1. **Markdown Native Tables (`NodeTable`)**: Wraps `@tgrosinger/md-advanced-tables` core via a SiYuan `ITextEditor` adapter (formatting, navigation, reorder, calculation, charting, DB conversion, export).
2. **HTML Complex Tables (`NodeHTMLBlock`)**: Visual dialog editor with cell merge/split, styling, and conversion to native Markdown table.

```
[Markdown Path]
Command / Key / UI → commands.ts (resolveTableBlockAndId) → SiyuanTextEditor (ITextEditor) → TableEditor → @tgrosinger/md-advanced-tables
                                                                   ↑ (reload)                                 ↓ (flush)
                                                           GET /api/block/getBlockKramdown            POST /api/block/updateBlock

[HTML Path]
HtmlFloatingToolbar / Dock → HtmlDialogEditor ↔ html-dialog-utils.ts → HtmlTableEditor → POST /api/block/updateBlock
                                                      ↳ html-to-md.ts → Native Markdown Table
```

## Source Files

### Core & Markdown Engine
- `src/index.ts` — Plugin entry, lifecycle, command/dock/toolbar registration, settings init.
- `src/siyuan-text-editor.ts` — `ITextEditor` adapter with in-memory line model, loads kramdown, writes via `updateBlock`. Exposes line access APIs (`getLineCount`, `getLineAt`, `setLineAt`, `insertLineAt`, `removeLine`, `markDirty`).
- `src/table-editor.ts` — Facade over core library; cell formulas/sum, copy/paste, split/resize operations.
- `src/table-model.ts` — Pure functions: Kramdown ↔ 2D matrix conversion, alignment parsing, separator detection, batch row/col deletion.
- `src/commands.ts` — 20+ table commands, centralized dispatch with `resolveTableBlockAndId` context helper.

### UI & Interactions
- `src/dock.ts` — Side panel toolbox (operations, alignment, formulas, charts, DB, exports, samples).
- `src/floating-toolbar.ts` — Cursor-following toolbar for Markdown tables.
- `src/drag-reorder.ts` — Row/column drag-and-drop handles & indicator lines.
- `src/quick-calc.ts` — Alt+drag multi-cell quick calculation (sum, average, count; supports thousands separators & percentages).
- `src/smart-paste.ts` — Clipboard HTML/TSV table grid parsing & smart insertion.
- `src/dom-utils.ts` — DOM table lookup, Range ↔ (row, col) coordinate mapping, cell highlighting, `escapeHtml`.

### HTML Complex Table Editor
- `src/html-dialog-editor.ts` — Visual dialog editor (merge/split cells, styles, borders, padding, undo/redo).
- `src/html-dialog-utils.ts` — Pure functions: Markdown ↔ HTML conversion, HTML sanitization, style stripping, span calculation.
- `src/html-floating-toolbar.ts` — Floating button to trigger HTML dialog editor.
- `src/html-table-editor.ts` — HTML block reader & updater.
- `src/html-to-md.ts` — HTML table to SiYuan native Markdown table conversion algorithm.
- `src/html-commands.ts` — HTML table shortcut commands.

### Transformations & Extensions
- `src/table-to-db-dialog.ts` & `src/table-to-db-utils.ts` — Markdown table to SiYuan Database / Attribute View (AV) with smart column type inference (text, number, date, select, mSelect, checkbox, url).
- `src/table-to-chart.ts` & `src/table-to-chart-utils.ts` — Markdown table to ECharts chart option generation & code block generator.
- `src/table-export.ts` — Export table to CSV / XLSX.
- `src/text-to-table.ts` & `src/text-to-table-utils.ts` — Convert raw formatted text to Markdown table.
- `src/sample-tables.ts` — Sample Markdown and HTML tables generation.

### Shared & Infrastructure
- `src/types/index.ts` — Consolidated exported domain models and interface types.
- `src/utils/index.ts` — Unified namespace export for utility pure functions.
- `src/utils/number-utils.ts` — Pure functions for number parsing (`parseNumber`) and formatting (`formatResult`).
- `src/utils/icons.ts` — Consolidated SVG icon definitions.
- `src/settings.ts` — `PluginSettings` interface and storage helpers.
- `src/logger.ts` — Centralized toggleable console logging.
- `src/confirm-dialog.ts` — Common confirmation modal.
- `src/index.scss` & `src/html-dialog.scss` — Scss design tokens & styles.

## Key Design Patterns & Constraints

1. **Write Path**: Always use SiYuan kernel API `POST /api/block/updateBlock` with `dataType: "markdown"`.
2. **Adapter Encapsulation**: Never access `(ctx as any)._lines`. Use public methods on `SiyuanTextEditor` (`getLineCount()`, `getLineAt()`, `setLineAt()`, `insertLineAt()`, `removeLine()`, `markDirty()`).
3. **Line Model Mapping**:
   - `_lines[0]` = Header row
   - `_lines[1]` = Separator (`| :--- | ---: |`)
   - `_lines[2+]` = Data rows
   - IAL line (`{: id="..."}`) is tracked and preserved separately.
4. **Pure Function Separation**: Keep all parsing/transformation logic in testable pure utility files (`*-utils.ts`, `table-model.ts`, `html-to-md.ts`, `table-export.ts`, `utils/number-utils.ts`) without DOM or SiYuan API dependencies.

## Tests (223 tests across 17 suites)

- `table-model.test.ts` (33) — Kramdown table parsing & row splitting
- `kramdown-roundtrip.test.ts` (32) — Kramdown formatting & round-trip fidelity
- `text-to-table.test.ts` (25) — Text to table parsing & box-drawing handling
- `core-library.test.ts` (21) — Core library integration via `InMemoryTextEditor`
- `delete-multiple.test.ts` (16) — Multi-row / multi-col batch deletion
- `html-dialog-utils.test.ts` (15) — HTML dialog pure functions & table conversions
- `html-to-md.test.ts` (13) — HTML table to Markdown converter
- `quick-calc.test.ts` (12) — Number parsing & formatting (`number-utils`)
- `sum-cells.test.ts` (10) — Cell sum operations
- `table-to-db-utils.test.ts` (9) — DB column type inference & payload formatting
- `table-to-chart-utils.test.ts` (8) — ECharts options & dual Y-axis calculation
- `clipboard-operations.test.ts` (7) — Copy/paste cell range
- `table-export.test.ts` (7) — CSV/XLSX text stripping & extraction
- `split-all-cells.test.ts` (6) — Table splitting
- `dom-utils.test.ts` (5) — Coordinate & escaping utilities
- `settings.test.ts` (2) — Default settings validation
- `resize-table.test.ts` (2) — Table resizing
