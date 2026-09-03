// src/rows/identity.ts
import { getGlyph } from "../glyphs.ts";
import type { Fragment, RowDetail } from "../types.ts";
import type { Row, RowSnapshot } from "./registry.ts";

// Copied from v1 src/segments/model.ts (deleted in Task 12).
function formatModelName(modelId: string | undefined): string {
  if (!modelId) return "no-model";
  const slash = modelId.indexOf("/");
  let name = slash > 0 ? modelId.slice(slash + 1) : modelId;
  const colon = name.indexOf(":");
  if (colon > 0) name = name.slice(0, colon);
  return name;
}

export function createIdentityRow(): Row {
  return {
    id: "identity",
    priority: 1,
    render(snapshot: RowSnapshot, detail: RowDetail): Fragment[] | null {
      const s = snapshot.session;
      const frags: Fragment[] = [];
      // D5: session name is the bright headline lead.
      if (snapshot.config.display.showSession && s.sessionName) {
        frags.push({ text: s.sessionName.trim(), color: "text" });
      }
      if (detail >= 2) frags.push({ text: `${frags.length > 0 ? " " : ""}${s.repoName}`, color: "dim" });
      if (s.branch && detail >= 1) {
        frags.push({ text: `${frags.length > 0 ? " " : ""}${getGlyph("git_branch", snapshot.glyphStyle)} ${s.branch}`, color: "toolTitle" });
        const g = snapshot.git;
        if (g) {
          if (g.dirty) frags.push({ text: "*", color: "toolTitle" });
          const marks = [
            g.ahead !== null && g.ahead > 0 ? `↑${g.ahead}` : null,
            g.behind !== null && g.behind > 0 ? `↓${g.behind}` : null,
          ].filter((m): m is string => m !== null);
          if (marks.length > 0) frags.push({ text: ` ${marks.join(" ")}`, color: "toolTitle" });
        }
      }
      const modelGlyph = getGlyph("model", snapshot.glyphStyle);
      frags.push({ text: `${frags.length > 0 ? " | " : ""}${modelGlyph ? modelGlyph + " " : ""}${formatModelName(s.modelId)}`, color: "accent" });
      // Thinking level rides the model (v0.4.6): the requested reasoning effort for future
      // turns — `off` included, so a disabled state is visible, not silently absent.
      // detail>=1 shrink casualty (the model itself survives to detail 0).
      if (detail >= 1) {
        frags.push({ text: ` · ${s.thinkingLevel}`, color: "dim" });
      }
      return frags;
    },
  };
}
