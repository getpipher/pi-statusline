// src/segments/context.ts
export interface ContextUsage {
  tokens: number | null;
  contextWindow: number;
  percent: number | null;
}

export function renderContextSegment(usage: ContextUsage | null | undefined): string {
  if (!usage) return "";
  if (usage.percent !== null && Number.isFinite(usage.percent)) {
    return `${Math.round(usage.percent)}%`;
  }
  if (usage.tokens === null || usage.contextWindow <= 0) return "";
  return `${Math.round((usage.tokens / usage.contextWindow) * 100)}%`;
}
