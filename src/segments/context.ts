// src/segments/context.ts
export interface ContextUsage {
  tokens: number;
  maxTokens: number;
}

export function renderContextSegment(usage: ContextUsage | null | undefined): string {
  if (!usage || !usage.maxTokens || usage.maxTokens <= 0) return "";
  const pct = Math.round((usage.tokens / usage.maxTokens) * 100);
  return `${pct}%`;
}
