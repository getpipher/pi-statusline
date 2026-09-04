// src/tui/arrangePanel.ts
import { renderRows, type RowRegistry, type RowSnapshot } from "../rows/registry.ts";
import {
  addComponent, applyDraft, createDraftState, moveLine, removeLine, selectLine,
  type ArrangeDraft,
} from "./arrangeModel.ts";
import { KNOWN_ROW_IDS } from "../types.ts";
import type { Theme } from "@earendil-works/pi-coding-agent";

// Interactive WYSIWYG editor (v0.6.0): the PREVIEW is the DRAFT rendered through the real
// registry + live snapshot — the identical path the footer takes, so what you see is
// byte-for-byte what you get on save. Pure shell over the arrangeModel functions.

export interface ArrangePanelDeps {
  registry: RowRegistry;
  snapshot: RowSnapshot;
  initial: string[];
  /** pi's full Theme instance (from the ctx.ui.custom factory). Optional — tests run themeless. */
  theme?: Theme;
  onChange(): void;
  onDone(value: string[] | null): void;
}

const HELP = "a add · x remove · [ move up · ] move down · enter save · esc cancel";

export function createArrangePanel(deps: ArrangePanelDeps) {
  let draft: ArrangeDraft = createDraftState(deps.initial);
  let paletteOpen = false;
  let paletteIndex = 0;
  let saved: string[] | null = null;

  const strip = (l: string) => l.replace(/\x1b\[[0-9;]*m/g, "");
  const dim = (s: string) => (deps.theme ? deps.theme.fg("dim", s) : s);
  const accent = (s: string) => (deps.theme ? deps.theme.fg("accent", s) : s);

  function paletteItems(): string[] {
    const onLine = new Set(draft.lines[draft.selected]?.split("+") ?? []);
    return KNOWN_ROW_IDS.filter((id) => !onLine.has(id));
  }

  function closePanel(value: string[] | null): void {
    saved = value;
    deps.onDone(value);
  }

  function handleLineKeys(data: string): boolean {
    if (data === "a") { paletteOpen = true; paletteIndex = 0; deps.onChange(); return true; }
    if (data === "x") { draft = removeLine(draft, draft.selected); deps.onChange(); return true; }
    if (data === "[") { draft = moveLine(draft, -1); deps.onChange(); return true; }
    if (data === "]") { draft = moveLine(draft, 1); deps.onChange(); return true; }
    if (data === "\r") { closePanel(applyDraft(draft)); return true; }
    if (data === "\x1b") { closePanel(null); return true; }
    return false;
  }

  return {
    getResult: () => saved,
    component: {
      render(width: number): string[] {
        const out: string[] = [];
        // Armory panel frame (armory-todo/armory-fleet parity): DynamicBorder top/bottom
        // + blank spacers — DynamicBorder.render(width) = color("─".repeat(max(1, width))).
        const border = accent("─".repeat(Math.max(1, width)));
        out.push(border);
        out.push("");
        // WYSIWYG preview: the DRAFT through the real registry — same path as the footer.
        out.push(dim("  PREVIEW (live)"));
        const rendered = renderRows(deps.registry, applyDraft(draft), {
          ...deps.snapshot, width, order: applyDraft(draft),
        });
        if (rendered.length === 0) out.push(dim("  (no lines — press a to add)"));
        for (const line of rendered) {
          out.push(dim("  " + strip(line.map((f) => f.text).join("")).slice(0, Math.max(0, width - 4))));
        }
        out.push("");
        draft.lines.forEach((l, i) => {
          const marker = i === draft.selected ? accent("►") : " ";
          out.push(`${marker} ${l}${l.includes("+") ? dim("  (compound)") : ""}`);
        });
        if (draft.lines.length === 0) out.push(dim("  (no lines — press a to add)"));
        out.push("");
        if (paletteOpen) {
          const items = paletteItems();
          out.push(dim("  ADD COMPONENT (↑↓ navigate · enter add · esc back)"));
          items.forEach((id, i) => {
            out.push(`  ${i === paletteIndex ? accent("►") : " "} ${id}`);
          });
        } else {
          out.push(dim("  " + HELP));
        }
        out.push("");
        out.push(border);
        return out;
      },
      invalidate(): void {},
      handleInput(data: string): void {
        if (paletteOpen) {
          const items = paletteItems();
          if (data === "\x1b[A") { paletteIndex = Math.max(0, paletteIndex - 1); deps.onChange(); return; }
          if (data === "\x1b[B") { paletteIndex = Math.min(items.length - 1, paletteIndex + 1); deps.onChange(); return; }
          if (data === "\r") {
            const id = items[Math.min(paletteIndex, items.length - 1)];
            if (id) draft = addComponent(draft, draft.selected, id);
            paletteOpen = false;
            deps.onChange();
            return;
          }
          if (data === "\x1b") { paletteOpen = false; deps.onChange(); return; }
          return;
        }
        if (data === "\x1b[A") { draft = selectLine(draft, draft.selected - 1); deps.onChange(); return; }
        if (data === "\x1b[B") { draft = selectLine(draft, draft.selected + 1); deps.onChange(); return; }
        if (handleLineKeys(data)) return;
      },
    },
  };
}
