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

export function renderTokensSegment(entries: SessionEntry[]): string {
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
  const fmt = (n: number): string => (n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`);
  return `↑${fmt(input)} ↓${fmt(output)}`;
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
