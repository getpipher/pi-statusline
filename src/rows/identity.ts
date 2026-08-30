// src/rows/identity.ts
import type { Fragment } from "../types.ts";
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
    render(snapshot: RowSnapshot): Fragment[] | null {
      const s = snapshot.session;
      const frags: Fragment[] = [];
      // D5: session name is the bright headline lead.
      if (snapshot.config.display.showSession && s.sessionName) {
        frags.push({ text: s.sessionName.trim(), color: "text" });
      }
      frags.push({ text: `${frags.length > 0 ? " " : ""}${s.repoName}`, color: "dim" });
      if (s.branch) frags.push({ text: ` ⎇ ${s.branch}`, color: "toolTitle" });
      frags.push({ text: ` | ${formatModelName(s.modelId)}`, color: "accent" });
      return frags;
    },
  };
}
