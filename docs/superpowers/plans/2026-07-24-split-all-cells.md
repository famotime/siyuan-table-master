# 全拆分命令 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在侧栏高级操作区增加“全拆分”命令，解除当前表格所有单元格的横向和纵向合并。

**Architecture:** `TableEditor` 在行模型中移除每个单元格 IAL 内的 `colspan`、`rowspan`；命令注册与侧栏只负责分发和展示。复用既有 `reload`、`setLineAt`、`flush` 写回链路，避免操作渲染 DOM。

**Tech Stack:** TypeScript、Vitest、SiYuan Plugin API、`@tgrosinger/md-advanced-tables`

---

### Task 1: 为全拆分添加回归测试

**Files:**
- Create: `__tests__/split-all-cells.test.ts`
- Test: `__tests__/split-all-cells.test.ts`

- [ ] **Step 1: 写入失败测试**

```ts
it("移除全表单元格的 colspan 和 rowspan，保留其他属性与内容", async () => {
  const editor = new MockSiyuanTextEditor([
    '| 标题 {: colspan="2" data-type="x"} | C |',
    '| --- | --- |',
    '| 内容 {: rowspan="3" style="color:red"} | B |',
  ]);
  await new TableEditor(editor as any).splitAllCells();
  expect(editor.lines).toEqual([
    '| 标题 {: data-type="x"} | C |',
    '| --- | --- |',
    '| 内容 {: style="color:red"} | B |',
  ]);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- __tests__/split-all-cells.test.ts`

Expected: FAIL，提示 `splitAllCells` 不存在。

- [ ] **Step 3: 补充无合并单元格不变的测试**

```ts
it("表格不含合并属性时不修改行内容", async () => {
  const original = ['| A {: data-type="x"} | B |', '| --- | --- |', '| 1 | 2 |'];
  const editor = new MockSiyuanTextEditor(original);
  await new TableEditor(editor as any).splitAllCells();
  expect(editor.lines).toEqual(original);
});
```

### Task 2: 实现全拆分行模型操作

**Files:**
- Modify: `src/table-editor.ts`
- Test: `__tests__/split-all-cells.test.ts`

- [ ] **Step 1: 添加最小实现**

```ts
async splitAllCells(): Promise<void> {
  await this.ctx.reload();
  for (let lineIndex = 0; lineIndex < this.ctx.getLineCount(); lineIndex++) {
    const line = this.ctx.getLineAt(lineIndex);
    if (!line || isSeparatorLine(line)) continue;
    const cells = splitTableRow(line);
    const splitCells = cells.map(removeMergeAttributes);
    if (splitCells.some((cell, index) => cell !== cells[index])) {
      this.ctx.setLineAt(lineIndex, `| ${splitCells.join(" | ")} |`);
    }
  }
  await this.ctx.flush();
}

function removeMergeAttributes(cell: string): string {
  return cell.replace(/\{:\s*([^}]*)\}/g, (_match, attributes: string) => {
    const remaining = attributes.replace(/\s+(?:colspan|rowspan)="[^"]*"/g, "").trim();
    return remaining ? `{: ${remaining}}` : "";
  }).trim();
}
```

- [ ] **Step 2: 运行单测确认通过**

Run: `npm test -- __tests__/split-all-cells.test.ts`

Expected: PASS，两个测试均通过。

- [ ] **Step 3: 提交逻辑与测试**

Run: `git add src/table-editor.ts __tests__/split-all-cells.test.ts; git commit -m "feat: 支持全拆分合并单元格"`

### Task 3: 接入命令、侧栏图标与本地化

**Files:**
- Modify: `src/commands.ts`
- Modify: `src/dock.ts`
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`
- Test: `npm test`、`npm run build`

- [ ] **Step 1: 注册命令**

```ts
{ id: "split-all-cells", nameZh: "全拆分", nameEn: "Split all cells", action: te => te.splitAllCells() },
```

- [ ] **Step 2: 在列求和后添加图标和侧栏入口**

```ts
"split-all-cells": `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" style="fill:none!important"/><path d="M12 3v18M3 12h18" style="fill:none!important"/><path d="m8 8 2 2m4 4 2 2m0-8-2 2m-4 4-2 2" style="fill:none!important"/></svg>`,
```

将 `split-all-cells` 插入高级操作分组的 `column-sum` 之后，并在两个语言文件中加入 `split-all-cells` 与 `kw-split-all-cells` 文案。

- [ ] **Step 3: 运行全量测试和生产构建**

Run: `npm test; npm run build`

Expected: 两条命令退出码均为 0。

- [ ] **Step 4: 提交 UI 接入**

Run: `git add src/commands.ts src/dock.ts src/i18n/zh_CN.json src/i18n/en_US.json; git commit -m "feat: 添加全拆分命令图标"`
