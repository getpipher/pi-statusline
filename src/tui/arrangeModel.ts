// src/tui/arrangeModel.ts

// Pure draft-state for the /statusline arrange editor (v0.6.0). All functions are
// immutable (return new drafts) so the panel component can hold one draft and re-render
// per keystroke. Line specs are the same compound strings as display.rows ("model+ctx").

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

export function moveLine(d: ArrangeDraft, delta: number): ArrangeDraft {
  const target = d.selected + delta;
  if (target < 0 || target >= d.lines.length) return selectLine(d, d.selected);
  const lines = [...d.lines];
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
  // Standard list-delete UX: the cursor STAYS at the removed index — the next line
  // shifts into it — clamped when the last line was removed.
  return { lines, selected: Math.max(0, Math.min(lineIndex, lines.length - 1)) };
}

export function applyDraft(d: ArrangeDraft): string[] {
  return d.lines.filter((l) => l.length > 0);
}
