// src/footer.ts
import { visibleWidth } from "@earendil-works/pi-tui";
import type { StatuslineConfig } from "./config.ts";
import { renderModelSegment } from "./segments/model.ts";

export interface FooterRenderInput {
  modelId: string | undefined;
  sessionName: string;
  gitBranch: string | null;
  tokens: string;
  ctxPct: string;
  statuses: string;
  quota: string | null;
  config: StatuslineConfig;
}

// Canonical segment order: [model, git, tokens, ctx, statuses, quota].
// truncateSegments drops from the RIGHT (quota → statuses → ctx → tokens → git),
// so this order IS the drop order — missing or disabled segments are
// simply absent and never break the indices.
export function composeSegments(input: FooterRenderInput): string[] {
  const parts: string[] = [];

  // Model badge — always present (index 0). renderModelSegment is the canonical formatter
  // (strips provider prefix + :variant suffix; "no-model" fallback for undefined).
  parts.push(renderModelSegment(input.modelId));

  // Session name — the "what am I working on" identity (/name); omitted when unset.
  if (input.config.display.showSession && input.sessionName) {
    parts.push(input.sessionName);
  }

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

  // Other extensions' status text — surfaced so replacing the native footer does
  // not discard neighboring extensions' setStatus output.
  if (input.statuses) {
    parts.push(input.statuses);
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
