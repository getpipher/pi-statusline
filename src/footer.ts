// src/footer.ts
import { visibleWidth } from "@earendil-works/pi-tui";
import type { StatuslineConfig } from "./config.ts";
import { renderModelSegment } from "./segments/model.ts";

export interface FooterRenderInput {
  modelId: string | undefined;
  gitBranch: string | null;
  tokens: string;
  ctxPct: string;
  quota: string | null;
  config: StatuslineConfig;
}

// Canonical segment order: [model, git, tokens, ctx, quota].
// truncateSegments drops from the RIGHT (quota → ctx → tokens → git), so this
// order IS the drop order — missing segments (empty git, disabled tokens) are
// simply absent and never break the indices.
export function composeSegments(input: FooterRenderInput): string[] {
  const parts: string[] = [];

  // Model badge — always present (index 0). renderModelSegment is the canonical formatter
  // (strips provider prefix + :variant suffix; "no-model" fallback for undefined).
  parts.push(renderModelSegment(input.modelId));

  // Git branch
  if (input.config.display.showGit && input.gitBranch) {
    parts.push(input.gitBranch);
  }

  // Tokens
  if (input.config.display.showTokens && input.tokens) {
    parts.push(input.tokens);
  }

  // Context %
  if (input.config.display.showContext && input.ctxPct) {
    parts.push(input.ctxPct);
  }

  // Quota (subscription-scoped — shown whenever we have data) — LAST = first dropped
  if (input.quota) {
    parts.push(input.quota);
  }

  return parts;
}

// Drop from the right until it fits; index 0 (model badge) is always kept.
// Uses pi-tui visibleWidth so multi-cell glyphs (⚡ ↑ ↓ ·) measure correctly.
export function truncateSegments(segments: string[], maxWidth: number): string[] {
  const kept = segments.filter((s) => s !== "");
  while (kept.length > 1 && visibleWidth(kept.join(" ")) > maxWidth) {
    kept.pop();
  }
  return kept;
}
