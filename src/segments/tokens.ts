// src/segments/tokens.ts
interface SessionEntry {
  type: string;
  message?: {
    role?: string;
    usage?: {
      input?: number;
      output?: number;
      cacheRead?: number;
      cacheWrite?: number;
      totalTokens?: number;
    };
  };
}

export function formatTokenCount(count: number): string {
  if (count < 1000) return `${count}`;
  const thousands = count / 1000;
  return thousands < 10 ? `${thousands.toFixed(1)}k` : `${Math.round(thousands)}k`;
}

export function renderTokensSegment(entries: SessionEntry[]): string {
  const { input, output } = computeTokenTotals(entries);
  return `↑${formatTokenCount(input)} ↓${formatTokenCount(output)}`;
}

export function computeTokenTotals(entries: SessionEntry[]): { input: number; output: number } {
  let input = 0;
  let output = 0;
  for (const e of entries) {
    if (e.type === "message" && e.message?.role === "assistant") {
      const u = e.message.usage;
      if (u) {
        input += u.input ?? 0;
        output += u.output ?? 0;
      }
    }
  }
  return { input, output };
}
