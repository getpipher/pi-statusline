// src/rows/model.ts
import { getGlyph } from "../glyphs.ts";
import type { Fragment, RowDetail } from "../types.ts";
import type { Row, RowSnapshot } from "./registry.ts";

// Standalone model row (v0.5.0): selected model + thinking level, bare lead — designed
// to be composed onto another line via compound specs (e.g. "model+ctx"). NOT in the
// default rows: identity keeps rendering the model there (zero-change contract), and
// identity suppresses its model fragment whenever a "model" line-part exists.
export function createModelRow(): Row {
  return {
    id: "model",
    priority: 1,
    render(snapshot: RowSnapshot, detail: RowDetail): Fragment[] | null {
      const s = snapshot.session;
      const glyph = getGlyph("model", snapshot.glyphStyle);
      const frags: Fragment[] = [{ text: `${glyph ? glyph + " " : ""}${s.modelId ?? "no-model"}`, color: "accent" }];
      if (detail >= 1) {
        frags.push({ text: ` · ${s.thinkingLevel}`, color: "dim" });
      }
      return frags;
    },
  };
}
