# AGENTS.md

Project overview for AI coding agents working in this repository.

## Build & Test

```bash
pnpm install && npm run build   # Production build
npm run dev                      # Dev mode (set VITE_SIYUAN_WORKSPACE_PATH in .env)
npm test                         # 103 tests (vitest)
npx tsc --noEmit                 # Type-check (some siyuan API type gaps expected)
```

## Architecture

SiYuan Note plugin enhancing NodeTable blocks via `@tgrosinger/md-advanced-tables` core library.

```
Command/Key → commands.ts → SiyuanTextEditor → TableEditor → core library
                                 (reload)         (flush)
                        GET /api/block/getBlockKramdown    POST /api/block/updateBlock
```

### Source Files

| File | Purpose |
|---|---|
| `src/index.ts` | Plugin lifecycle, settings UI, sub-module init |
| `src/commands.ts` | Command registry + dispatch |
| `src/text-to-table.ts` | Text-to-table UI (`executeTextToTable`, dialog) |
| `src/text-to-table-utils.ts` | Text-to-table pure functions (`parseLines`, `gridToMarkdown`, etc.) |
| `src/table-editor.ts` | Core library facade + copy/paste/sum operations |
| `src/siyuan-text-editor.ts` | `ITextEditor` adapter — in-memory line model with `getLineAt/setLineAt/markDirty` public API |
| `src/table-model.ts` | Kramdown ↔ line arrays pure functions |
| `src/dom-utils.ts` | DOM: find table, Range↔coord, highlight, `escapeHtml`, `getCellCoordFromTable` |
| `src/keybind.ts` | Tab/Enter capture-phase interception |
| `src/dock.ts` | Side panel toolbox |
| `src/floating-toolbar.ts` | Cursor-following toolbar |
| `src/smart-paste.ts` | HTML/TSV paste → grid → table |
| `src/quick-calc.ts` | Alt+drag multi-cell sum/average/count |
| `src/drag-reorder.ts` | Row/column drag reorder handles |
| `src/confirm-dialog.ts` | Paste override confirmation |
| `src/settings.ts` | Config interface + load/save |
| `src/utils/index.ts` | Shared utility re-exports |

### Tests (103 total)

- `table-model.test.ts` (29) — kramdown parsing
- `core-library.test.ts` (21) — core lib integration
- `kramdown-roundtrip.test.ts` (24) — round-trip fidelity
- `text-to-table.test.ts` (20) — text-to-table parsing
- `dom-utils.test.ts` (5) — DOM utility functions
- `helpers/InMemoryTextEditor.ts` — test double

### Key Patterns

- **Line model**: `_lines[0]=header, _lines[1]=separator, _lines[2+]=data`. IAL line stored separately.
- **Adapter encapsulation**: Never access `(ctx as any)._lines` — use `getLineCount()/getLineAt()/setLineAt()/insertLineAt()/removeLine()/markDirty()`.
- **Settings**: 10 boolean toggles managed via `PluginSettings` interface in `settings.ts`.
