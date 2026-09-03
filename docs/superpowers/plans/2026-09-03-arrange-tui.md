# Arrange TUI (WYSIWYG /statusline editor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/statusline arrange` opens an interactive TUI where the user re-arranges footer lines (add/remove/reorder compound specs) with a LIVE preview rendered through the real row registry and their real session data — WYSIWYG.

**Architecture:** Pure draft-state module (`arrangeModel.ts`) holds all arrangement logic as testable functions operating on `string[]` line specs. A pi-tui `Container` component (`arrangePanel.ts`) renders the live preview (via the real `renderRows`) + line list + component palette, routing `handleInput` to the draft functions. A thin command case (`/statusline arrange`) opens the panel via `ctx.ui.custom`, and on save persists via the existing `saveConfig` + re-render.

**Tech Stack:** TypeScript, `@earendil-works/pi-tui` (`Container`, `DynamicBorder`, `Text`, `SelectList`), existing `renderRows`/registry, `saveConfig`.

## Global Constraints

- 2-space indent, TypeScript strict, raw `.ts` (no build step).
- No AI attribution anywhere. Org spelling: getpipher (two p's).
- Default config MUST stay byte-identical: `model` stays out of default rows; this feature adds NO default changes.
- TDD: every task RED → GREEN → commit. `pnpm typecheck` + `pnpm test:run` green before each commit.
- Verified pi API facts (pi 0.84.4, docs/tui.md — do NOT re-derive):
  - `const result = await ctx.ui.custom<T>((tui, theme, _kb, done) => component)` — component: `{ render(width): string[]; invalidate(): void; handleInput?(data): void }`.
  - `done(value)` resolves the promise and closes; `tui.requestRender()` repaints after `handleInput`.
  - `SelectList(items, maxVisible, colorFns)` with `.onSelect = (item) => …`, `.onCancel = () => …`, `.handleInput(data)` handles ↑↓/enter/esc internally.
  - `Container.addChild(child)`, `DynamicBorder((s) => theme.fg("accent", s))`, `Text(text, 1, 0)`; render via `container.render(w)`.
  - Arrow keys / enter / esc arrive as escape sequences inside `handleInput(data)`; SelectList decodes them. For custom keys (`a`, `x`), match raw characters in `handleInput`.
- Component palette = the 7 known ids (`identity model ctx money quota deen ambient`) minus ids already in the selected line (an id CAN repeat across lines — allowed by design).
- Release: tag `v0.6.0` → release.yml; pins live + dotfiles bumped after npm verify.

---

### Task 1: Draft-state model (`arrangeModel.ts`)

**Files:**
- Create: `src/tui/arrangeModel.ts`
- Test: `test/arrange-model.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 2+3):
  - `interface ArrangeDraft { lines: string[]; selected: number }`
  - `createDraftState(rows: string[]): ArrangeDraft`
  - `moveLine(d: ArrangeDraft, delta: 1 | -1): ArrangeDraft` (clamped, immutable — returns new)
  - `selectLine(d: ArrangeDraft, index: number): ArrangeDraft`
  - `addComponent(d: ArrangeDraft, lineIndex: number, id: string): ArrangeDraft` (append id to that line's `+` parts, deduped; dedupe whole-entry idempotence: `model+ctx` + `model` → `model+ctx` unchanged)
  - `removeLine(d: ArrangeDraft, lineIndex: number): ArrangeDraft` (selected clamps to remaining lines; empty draft allowed → renders "no lines" state)
  - `applyDraft(d: ArrangeDraft): string[]` (strip empty lines)

- [ ] **Step 1: Write the failing tests**

```typescript
// test/arrange-model.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createDraftState, moveLine, selectLine, addComponent, removeLine, applyDraft,
} from "../src/tui/arrangeModel.ts";

const START = ["identity", "model+ctx", "money", "quota", "deen", "ambient"];

test("createDraftState: lines copied, selection 0", () => {
  const d = createDraftState(START);
  assert.deepEqual(d.lines, START);
  assert.equal(d.selected, 0);
});

test("moveLine: down then up, clamped at edges, original untouched", () => {
  const d = createDraftState(START);
  const down = moveLine(d, 1);
  assert.deepEqual(down.lines, ["model+ctx", "identity", "money", "quota", "deen", "ambient"]);
  assert.equal(down.selected, 1);
  const up = moveLine(down, -1);
  assert.deepEqual(up.lines, START);
  assert.equal(moveLine(d, -1).selected, 0, "clamped at top");
  assert.equal(moveLine(createDraftState(START), 99).selected, START.length - 1, "clamped at bottom");
  assert.deepEqual(d.lines, START, "immutable: original untouched");
});

test("addComponent: appends deduped within the line", () => {
  const d = createDraftState(START);
  const withQuota = addComponent(d, 1, "quota");
  assert.equal(withQuota.lines[1], "model+ctx+quota");
  assert.equal(addComponent(withQuota, 1, "model").lines[1], "model+ctx", "deduped within line");
});

test("removeLine: removes, selection clamps, applyDraft strips empties", () => {
  const d = createDraftState(START);
  const one = removeLine(d, 1);
  assert.deepEqual(one.lines, ["identity", "money", "quota", "deen", "ambient"]);
  assert.equal(one.selected, 1, "selection stays at removed index");
  let empty = createDraftState(START);
  for (let i = 0; i < 6; i++) empty = removeLine(empty, 0);
  assert.deepEqual(applyDraft(empty), [], "all removed → empty spec list");
  assert.equal(empty.selected, 0);
});

test("applyDraft: passes lines through verbatim", () => {
  const d = createDraftState(["identity", "model+ctx"]);
  assert.deepEqual(applyDraft(d), ["identity", "model+ctx"]);
});
```

- [ ] **Step 2: Run to verify FAIL** — `pnpm vitest …` is not used; run `node --import tsx --test test/arrange-model.test.ts 2>&1 | tail -5`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `src/tui/arrangeModel.ts`**

```typescript
// src/tui/arrangeModel.ts
export interface ArrangeDraft {
  lines: string[];
  selected: number;
}

export function createDraftState(rows: string[]): ArrangeDraft {
  return { lines: [...rows], selected: 0 };
}

export function selectLine(d: ArrangeDraft, index: number): ArrangeDraft {
  const clamped = Math.max(0, Math.min(index, d.lines.length - 1));
  return { lines: [...d.lines], selected: Math.max(0, clamped) };
}

export function moveLine(d: ArrangeDraft, delta: 1 | -1): ArrangeDraft {
  const lines = [...d.lines];
  const target = d.selected + delta;
  if (target < 0 || target >= lines.length) return selectLine(d, d.selected);
  [lines[d.selected], lines[target]] = [lines[target]!, lines[d.selected]!];
  return { lines, selected: target };
}

export function addComponent(d: ArrangeDraft, lineIndex: number, id: string): ArrangeDraft {
  if (lineIndex < 0 || lineIndex >= d.lines.length) return d;
  const parts = d.lines[lineIndex]!.split("+");
  if (parts.includes(id)) return d; // deduped within line
  const lines = [...d.lines];
  lines[lineIndex] = [...parts, id].join("+");
  return { lines, selected: d.selected };
}

export function removeLine(d: ArrangeDraft, lineIndex: number): ArrangeDraft {
  if (lineIndex < 0 || lineIndex >= d.lines.length) return d;
  const lines = d.lines.filter((_, i) => i !== lineIndex);
  return { lines, selected: Math.max(0, Math.min(d.selected, lines.length - 1)) };
}

export function applyDraft(d: ArrangeDraft): string[] {
  return d.lines.filter((l) => l.length > 0);
}
```

- [ ] **Step 4: Run to verify PASS** — same command, expect all PASS.
- [ ] **Step 5: Commit** — `git add src/tui/arrangeModel.ts test/arrange-model.test.ts && git commit -m "feat: arrange draft-state model (move/add/remove line specs)"`

---

### Task 2: The WYSIWYG panel component (`arrangePanel.ts`)

**Files:**
- Create: `src/tui/arrangePanel.ts`
- Test: `test/arrange-panel.test.ts`

**Interfaces:**
- Consumes: `ArrangeDraft` functions (Task 1); `renderRows(registry, order, snapshot)` (existing); `Container`, `DynamicBorder`, `Text`, `SelectList` from `@earendil-works/pi-tui`; pi `Theme` via `theme.fg(token, text)`.
- Produces: `createArrangePanel(deps): { component: { render(width): string[]; invalidate(): void; handleInput(data): void }; getResult(): string[] | null }` where
  - `deps = { registry: RowRegistry; snapshot: RowSnapshot; initial: string[]; theme?: Theme; onChange(): void; onDone(value: string[] | null): void }`
  - the panel is handed to `ctx.ui.custom` by Task 3; `getResult()`/`onDone` return the applied draft (or null on cancel). `theme` is pi's full Theme instance (optional — tests run themeless).

- [ ] **Step 1: Write the failing tests**

```typescript
// test/arrange-panel.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createArrangePanel } from "../src/tui/arrangePanel.ts";
import { createRowRegistry } from "../src/rows/registry.ts";
import { createIdentityRow } from "../src/rows/identity.ts";
import { createModelRow } from "../src/rows/model.ts";
import { createContextRow } from "../src/rows/context.ts";
import { DEFAULT_CONFIG } from "../src/config.ts";
import type { RowSnapshot } from "../src/rows/registry.ts";
import type { DeenSource } from "../src/deen/source.ts";

function snapshot(): RowSnapshot {
  return {
    now: 0, width: 500, statuses: "", config: DEFAULT_CONFIG, deen: null, git: null,
    versions: { sl: "", pi: null }, glyphStyle: "unicode", barStyle: "blocks",
    session: { sessionName: "s", repoName: "r", branch: "main", modelId: "glm-5.2", provider: "zai",
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, count: 0 },
      contextTokens: 50_000, contextWindow: 200_000, contextPercent: 25, thinkingLevel: "high", spanMs: 0 },
    ledger: { todayCost: 1, last7Cost: 2, last30Cost: 3, repoCost: 0 },
  };
}

function makePanel(initial: string[], order?: string[]) {
  const registry = createRowRegistry([createIdentityRow(), createModelRow(), createContextRow()]);
  let result: string[] | null = null;
  const panel = createArrangePanel({
    registry, snapshot: snapshot(), initial,
    onDone: (value) => { result = value; },
  });
  return { panel, getResult: () => result };
}

test("renders WYSIWYG preview (real renderRows of the draft) + line list + help", () => {
  const { panel } = makePanel(["identity", "model+ctx"]);
  const out = panel.component.render(120).map((l) => l.replace(/\x1b\[[0-9;]*m/g, "")).join("\n");
  assert.match(out, /PREVIEW/, "preview section header");
  assert.match(out, /glm-5\.2 · high \| Ctx: 25%/, "preview = real render of draft line 2");
  assert.match(out, /► identity/, "selected line marker");
  assert.match(out, /model\+ctx/);
  assert.match(out, /a add · x remove · \[ move up · \] move down · enter save · esc cancel/);
});

test("handleInput: 'a' opens palette filtered to ids not on the selected line; enter adds", () => {
  const { panel } = makePanel(["identity"]);
  panel.component.render(120);
  panel.component.handleInput("a"); // open palette
  const out = panel.component.render(120).map((l) => l.replace(/\x1b\[[0-9;]*m/g, "")).join("\n");
  assert.match(out, /ADD COMPONENT/);
  assert.ok(!out.includes("► identity\n") || !/ADD COMPONENT[\s\S]*identity →/.test(out), "identity already on line → not offered");
  // palette: navigate to ctx (identity, model precede) then enter
  panel.component.handleInput("\x1b[B"); // down (identity → model)
  panel.component.handleInput("\x1b[B"); // down (model → ctx)
  panel.component.handleInput("\r");     // enter = add ctx to selected line
  const out2 = panel.component.render(120).map((l) => l.replace(/\x1b\[[0-9;]*m/g, "")).join("\n");
  assert.match(out2, /identity\+ctx/, "ctx appended to selected line");
});

test("handleInput: '[' / ']' move the selected line; 'x' removes it", () => {
  const { panel } = makePanel(["identity", "ctx"]);
  panel.component.render(120);
  panel.component.handleInput("\x1b[B"); // down → select ctx (selection index 1)
  panel.component.handleInput("[");      // move ctx up
  let out = panel.component.render(120).map((l) => l.replace(/\x1b\[[0-9;]*m/g, "")).join("\n");
  assert.ok(out.indexOf("► ctx") < out.indexOf("identity"), "ctx now above identity");
  panel.component.handleInput("x");      // remove selected (ctx)
  out = panel.component.render(120).map((l) => l.replace(/\x1b\[[0-9;]*m/g, "")).join("\n");
  assert.ok(!out.includes("► ctx"), "ctx line removed");
});

test("enter saves (done with applied draft), esc cancels (done null)", () => {
  const p1 = makePanel(["identity"]);
  p1.panel.component.render(120);
  p1.panel.component.handleInput("\r");
  assert.deepEqual(p1.getResult(), ["identity"], "enter → applied draft");
  const p2 = makePanel(["identity"]);
  p2.panel.component.render(120);
  p2.panel.component.handleInput("\x1b");
  assert.equal(p2.getResult(), null, "esc → null");
});
```

- [ ] **Step 2: Run to verify FAIL** — `node --import tsx --test test/arrange-panel.test.ts 2>&1 | tail -5`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `src/tui/arrangePanel.ts`**

```typescript
// src/tui/arrangePanel.ts
import { Container, DynamicBorder, Text, type SelectItem, SelectList } from "@earendil-works/pi-tui";
import { renderRows, type RowRegistry, type RowSnapshot } from "../rows/registry.ts";
import { addComponent, applyDraft, createDraftState, moveLine, removeLine, selectLine, type ArrangeDraft } from "./arrangeModel.ts";
import { KNOWN_ROW_IDS } from "../types.ts";
import type { Fragment } from "../types.ts";

export interface ArrangePanelDeps {
  registry: RowRegistry;
  snapshot: RowSnapshot;
  initial: string[];
  onDone(value: string[] | null): void;
}

// Interactive WYSIWYG editor (v0.6.0): preview = real renderRows of the DRAFT against the
// live snapshot; line list + palette below. Pure shell over arrangeModel functions.
export function createArrangePanel(deps: ArrangePanelDeps) {
  let draft: ArrangeDraft = createDraftState(deps.initial);
  let palette: { items: SelectItem[]; list: SelectList } | null = null;
  let saved: string[] | null = null;

  const stripAnsi = (l: string) => l.replace(/\x1b\[[0-9;]*m/g, "");

  function previewLines(width: number): string[] {
    // WYSIWYG: the DRAFT goes through the real registry — identical path to the footer.
    return renderRows(deps.registry, applyDraft(draft), { ...deps.snapshot, width, order: applyDraft(draft) });
  }

  function renderPreviewText(width: number): string[] {
    const frags = previewLines(width);
    const out = [deps.snapshot ? "  PREVIEW (live)" : "  PREVIEW"];
    if (frags.length === 0) out.push("  (no lines — add components below)");
    for (const line of frags) {
      out.push("  " + stripAnsi(line.map((f: Fragment) => f.text).join("")).slice(0, Math.max(0, width - 4)));
    }
    return out;
  }

  const container = new Container();
  const border = (s: string) => deps.snapshot && typeof deps.snapshot.config === "object" ? s : s;

  function themeOf(): (s: string) => string {
    // theme.fg injected via deps.theme by the command wiring; plain fallback in tests.
    return deps.theme ? (s: string) => deps.theme!.fg("accent", s) : (s: string) => s;
  }

  function rebuildStatic(): void {
    // (re-created per render instead — see render(); container children are static here.)
  }

  function paletteItems(): SelectItem[] {
    const currentParts = new Set(draft.lines[draft.selected]?.split("+") ?? []);
    return KNOWN_ROW_IDS
      .filter((id) => !currentParts.has(id))
      .map((id) => ({ value: id, label: id, description: "add to selected line" }));
  }

  function openPalette(): void {
    palette = {
      items: paletteItems(),
      list: new SelectList(paletteItems(), 7, {}),
    };
    palette.list.onSelect = (item) => {
      draft = addComponent(draft, draft.selected, item.value as string);
      palette = null;
      deps.onChange();
    };
    palette.list.onCancel = () => { palette = null; deps.onChange(); };
  }

  function handleLineKeys(data: string): boolean {
    if (data === "a") { openPalette(); return true; }
    if (data === "x") { draft = removeLine(draft, draft.selected); deps.onChange(); return true; }
    if (data === "[") { draft = moveLine(draft, -1); deps.onChange(); return true; }
    if (data === "]") { draft = moveLine(draft, 1); deps.onChange(); return true; }
    if (data === "\r") { saved = applyDraft(draft); deps.onDone(saved); return true; }
    if (data === "\x1b") { deps.onDone(null); return true; }
    return false;
  }

  return {
    getResult: () => saved,
    component: {
      render(width: number): string[] {
        const out: string[] = [];
        out.push(...renderPreviewText(width));
        out.push("");
        draft.lines.forEach((l, i) => {
          out.push(`${i === draft.selected ? "►" : " "} ${l}${l.includes("+") ? "  (compound)" : ""}`);
        });
        if (draft.lines.length === 0) out.push("  (no lines — press a to add)");
        out.push("");
        if (palette) {
          out.push("  ADD COMPONENT (↑↓ navigate · enter add · esc back)");
          for (const item of palette.items) out.push(`    ${item.label as string}`);
        } else {
          out.push("  a add · x remove · [ move up · ] move down · enter save · esc cancel");
        }
        return out.map((l) => (deps.theme ? deps.theme.fg("dim", l) : l));
      },
      invalidate(): void {},
      handleInput(data: string): void {
        if (palette) { palette.list.handleInput(data); return; }
        // SelectList-free line nav: arrows move the SELECTION between lines.
        if (data === "\x1b[A") { draft = selectLine(draft, draft.selected - 1); deps.onChange(); return; }
        if (data === "\x1b[B") { draft = selectLine(draft, draft.selected + 1); deps.onChange(); return; }
        if (handleLineKeys(data)) return;
      },
    },
  };
}
```

Implementation notes for the engineer (NOT placeholders — decisions):
- The preview is recomputed inside `render(width)` every frame (registry render is cheap at 6 rows) — no caching, no staleness.
- `deps.theme` is pi's full `Theme` (from the `ctx.ui.custom` factory arg), NOT `EditorTheme`. Optional so tests run themeless (plain text).
- Palette navigation delegates to a real `SelectList` (arrow/enter/esc decoding comes free); the line list is rendered manually because we need custom `[`/`]` reorder keys SelectList doesn't have.
- `known-ids` import: `KNOWN_ROW_IDS` is the atom list; compounds are built by repeated `a` additions.

- [ ] **Step 4: Run to verify PASS** — expect all arrange-panel tests PASS (adjust ANSI-stripping if themeless output needs it).
- [ ] **Step 5: Commit** — `git add src/tui/arrangePanel.ts test/arrange-panel.test.ts && git commit -m "feat: WYSIWYG arrange panel (live preview + line editor + palette)"`

---

### Task 3: `/statusline arrange` command wiring

**Files:**
- Modify: `src/tui/settings.ts` (add `{ action: "arrange" }` + parse case `arrange`)
- Modify: `src/index.ts` (handler: build snapshot deps → `ctx.ui.custom` → on save: set `config.display.rows`, `saveConfig`, notify)
- Modify: `src/index.ts` command `description` string (add `| arrange`)
- Test: `test/index-wiring.test.ts` (arrange case opens panel and saves)

**Interfaces:**
- Consumes: Tasks 1+2; existing `saveConfig(path, config)`; `deps.readVersions()`.
- Produces: `/statusline arrange` persists `display.rows` and re-renders without restart.

- [ ] **Step 1: Write the failing wiring test**

```typescript
// append to test/index-wiring.test.ts
test("v0.6.0 wiring: /statusline arrange opens the WYSIWYG panel and persists on save", async () => {
  const h = makeHarness();
  try {
    activateStatusline(h.pi, {
      authJsonPath: join(h.tmp, "auth.json"),
      configPath: h.configPath,
      ledgerPath: join(h.tmp, "ledger.jsonl"),
      readKey: () => "fixture-key",
      makeGitSource: () => h.fakeGitSource,
      makeAdapters: () => [h.fakeZaiAdapter],
    });
    h.handlers.get("session_start")?.({}, h.ctx);
    const command = h.commands.get("statusline");
    assert.ok(command);
    await command.handler("arrange", h.ctx);
    // The panel drives ctx.ui.custom; the harness fake resolves the factory with a
    // component whose enter-press applies the draft (["identity"]) — assert persistence.
    const persisted = JSON.parse(readFileSync(h.configPath, "utf8")) as { display: { rows: string[] } };
    assert.deepEqual(persisted.display.rows, ["identity"]);
    assert.ok(h.notifications.some((n) => n.message.includes("Arrangement saved")), "saved notify");
  } finally {
    h.footerHolder.current?.dispose();
    rmSync(h.tmp, { recursive: true, force: true });
  }
});
```

If the harness `ctx.ui.custom` fake does not resolve factories, extend it: capture the factory, invoke it with `{ requestRender() {}, }`, a themeless stub, then call the returned component's `handleInput("\r")` and resolve with the applied value. (Check `makeHarness`'s ctxObject first — the P2 deen test already drives `ctx.ui.custom` through it; reuse that pattern.)

- [ ] **Step 2: Run to verify FAIL** — `node --import tsx --test test/index-wiring.test.ts 2>&1 | grep -E "not ok|pass "`. Expected: the arrange test FAILS (unknown command).
- [ ] **Step 3: Implement**

`src/tui/settings.ts` — add to the union + switch:
```typescript
  | { action: "arrange" }
// …
    case "arrange":
      return { action: "arrange" };
```

`src/index.ts` — handler case (after `case "list-rows"`):
```typescript
        case "arrange": {
          const snapshot: RowSnapshot = {
            now: Date.now(),
            width: 120,
            session: sessionStore.getSnapshot(),
            ledger: ensureLedger().getSnapshot(),
            statuses: "",
            config,
            deen: deenSource.current(),
            git: gitSource.get(),
            versions: dependencies.readVersions(),
            order: config.display.rows,
            glyphStyle: config.display.glyphs,
            barStyle: config.display.barStyle,
          };
          const applied = await ctx.ui.custom<string[] | null>((tui, theme, _kb, done) => {
            const panel = createArrangePanel({
              registry,
              snapshot,
              initial: config.display.rows,
              theme,
              onChange: () => tui.requestRender(),
              onDone: (value) => done(value),
            });
            return panel.component;
          });
          if (applied) {
            config = { ...config, display: { ...config.display, rows: applied } };
            saveConfig(dependencies.configPath, config);
            ctx.ui.notify(`Arrangement saved: ${applied.join(", ")}`, "info");
          } else {
            ctx.ui.notify("Arrangement cancelled", "info");
          }
          requestRenderFn?.();
          break;
        }
```
Also: import `createArrangePanel`; extend the registerCommand description with `| arrange`.

- [ ] **Step 4: Run to verify PASS** — full suite: `pnpm typecheck && pnpm test:run`. Expected: 0 errors, all PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: /statusline arrange — interactive WYSIWYG line editor"`

---

### Task 4: Docs + release

**Files:**
- Modify: `README.md` (arrange section under the commands table)
- Modify: `package.json` version → `0.6.0`

- [ ] **Step 1: README** — add row to the commands table:
```markdown
| `/statusline arrange` | interactive WYSIWYG editor — move/add/remove lines with a live preview (↑↓ select · a add · x remove · [ ] reorder · ⏎ save) |
```
- [ ] **Step 2: Gate** — `pnpm typecheck && pnpm test:run` → 0 errors, all PASS. **(Lesson from v0.5.1: run this AFTER the final edit, never before.)**
- [ ] **Step 3: Commit + tag + push** —
```bash
python3 -c "import json; d=json.load(open('package.json')); d['version']='0.6.0'; json.dump(d, open('package.json','w'), indent=2); open('package.json','a').write('\n')"
git add -A && git restore --staged package.json && git commit -m "docs: /statusline arrange — WYSIWYG line editor" && git add package.json && git commit -m "chore: v0.6.0" && git -c tag.gpgSign=false tag -a v0.6.0 -m "v0.6.0: /statusline arrange — WYSIWYG arrangement editor" && git push origin main v0.6.0
```
- [ ] **Step 4: Verify release** — `sleep 45 && npm view @getpipher/pi-statusline version` → `0.6.0`; `gh run list --limit 3` → Release/CI green (tag-mirror fail = known #1). Bump pins live + dotfiles to `@0.6.0`. Restart pi to activate.
- [ ] **Step 5: tmux visual check** — pin-disable dance (backup → remove pin → `pi -e ./src/index.ts` → type `/statusline arrange` → capture pane → verify panel renders preview + line list → esc → restore pin + verify). Document any drift in the session handoff.

---

## Out of scope (v0.6.x follow-ups, do NOT build here)

- Live footer updates WHILE the panel is open (preview is snapshot-frozen at open — acceptable; data refreshes on save).
- Per-component inline detail toggles (showTokens etc.) in the panel — they stay JSON-only.
- Drag-and-drop reordering (mouse) — keyboard only.
