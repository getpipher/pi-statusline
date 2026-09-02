// src/format.ts
export function formatTokenCount(count: number): string {
  if (count < 1000) return `${count}`;
  const thousands = count / 1000;
  return thousands < 10 ? `${thousands.toFixed(1)}k` : `${Math.round(thousands)}k`;
}

// CCS-exact human token counts (claude-code-statusline _format_tokens_human): one decimal
// always for K/M, uppercase unit, plain integer below 1000 (e.g. 68.0K, 200.0K, 1.0M).
export function formatTokensHuman(count: number): string {
  if (!Number.isFinite(count) || count < 1000) return `${Math.floor(Math.max(0, count))}`;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  return `${(count / 1000).toFixed(1)}K`;
}

export function formatMoney(n: number): string {
  return n.toFixed(2);
}

export type BarStyle = "blocks" | "rounded" | "dots" | "shaded";

const BAR_CHARS: Record<BarStyle, { filled: string; empty: string }> = {
  blocks: { filled: "█", empty: "░" },
  rounded: { filled: "▰", empty: "▱" },
  dots: { filled: "●", empty: "○" },
  shaded: { filled: "▓", empty: "░" },
};

export function renderBar(ratio: number, cells = 10, style: BarStyle = "blocks"): string {
  const clamped = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
  const chars = BAR_CHARS[style] ?? BAR_CHARS.blocks;
  const filled = Math.round(clamped * cells);
  return `▕${chars.filled.repeat(filled)}${chars.empty.repeat(cells - filled)}▏`;
}

// Two-tone bar: head (`▕` + filled cells) takes the fill color (accent/warning/error),
// tail (empty cells + `▏`) stays dim — renderBar above stays for plain-string formats.
export function splitBar(ratio: number, cells = 10): { filled: string; empty: string } {
  const clamped = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
  const filledCount = Math.round(clamped * cells);
  return {
    filled: `▕${"█".repeat(filledCount)}`,
    empty: `${"░".repeat(cells - filledCount)}▏`,
  };
}


export function formatClock(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatSpan(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  if (hours <= 0) return `${totalMinutes}m`;
  return `${hours}h${totalMinutes % 60}m`;
}

// Countdown to a ms-epoch reset. v0.4.7: unit spaces (`3h 57m`, `6d 6h`) — RECTOR's
// pomodoro style for the quota-row parenthetical.
export function formatReset(targetMs: number, now: number): string {
  const remaining = targetMs - now;
  if (remaining <= 0) return "now";
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h ${minutes}m`;
}
