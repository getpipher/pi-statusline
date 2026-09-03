// src/tui/status.ts

export interface StatusAdapter {
  id: string;
  state: "ok" | "inert" | "no-data" | "error";
  detail: string;
}

export interface StatusInput {
  version: string;
  rows: string[];
  lastRender: { at: number; lines: string[] } | null;
  now: number;
  session: { provider: string | undefined; model: string | undefined; thinking: string; contextPercent: number | null };
  adapters: StatusAdapter[];
  deen: { detail: string } | null;
  git: { detail: string } | null;
  ledger: { detail: string };
}

const MAX_LINE = 100;

function age(ms: number): string {
  if (ms < 60_000) return `${Math.max(1, Math.floor(ms / 1000))}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  return `${Math.floor(ms / 3_600_000)}h`;
}

function trim(text: string): string {
  return text.length > MAX_LINE ? text.slice(0, MAX_LINE - 1) + "…" : text;
}

export function formatStatusMessage(input: StatusInput): string {
  const lines: string[] = [];
  lines.push(`pi-statusline ${input.version} — rows: ${input.rows.join(", ")}`);

  if (input.lastRender) {
    lines.push(`rendered ${age(Math.max(0, input.now - input.lastRender.at))} ago:`);
    input.lastRender.lines.forEach((l, i) => lines.push(`  L${i + 1}: ${trim(l)}`));
  } else {
    lines.push("rendered: never");
  }

  lines.push("sources:");
  const s = input.session;
  lines.push(`  session → ${s.provider ?? "?"}/${s.model ?? "no-model"} · thinking ${s.thinking} · ctx ${s.contextPercent !== null ? `${s.contextPercent}%` : "?"}`);
  for (const a of input.adapters) {
    lines.push(`  ${a.id.padEnd(7)} → ${a.state}${a.detail ? ` — ${a.detail}` : ""}`);
  }
  lines.push(`  deen    → ${input.deen?.detail ?? "omitted (no data)"}`);
  lines.push(`  git     → ${input.git?.detail ?? "no data"}`);
  lines.push(`  ledger  → ${input.ledger.detail}`);
  return lines.join("\n");
}
