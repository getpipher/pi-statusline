// src/segments/quota.ts
import type { QuotaResult } from "../quota/zai.ts";

function fmtReset(ms: number): string {
  const remaining = ms - Date.now();
  if (remaining <= 0) return "now";
  const hours = Math.floor(remaining / 3600_000);
  const minutes = Math.floor((remaining % 3600_000) / 60_000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d${hours % 24}h`;
  }
  return `${hours}h${minutes}m`;
}

export function renderQuotaSegment(quota: QuotaResult | null, dimmed: boolean): string {
  if (!quota) return "";

  const fmt = (n: number): string => {
    if (n < 1000) return `${n}`;
    const k = n / 1000;
    return k >= 10 ? `${Math.round(k)}k` : `${k.toFixed(1)}k`;
  };
  const parts: string[] = [];

  if (quota.fiveHour) {
    parts.push(`5h ${fmt(quota.fiveHour.currentValue)}/${fmt(quota.fiveHour.usage)} ${quota.fiveHour.percentage}%`);
  }
  if (quota.weekly) {
    parts.push(`wk ${fmt(quota.weekly.currentValue)}/${fmt(quota.weekly.usage)} ${quota.weekly.percentage}%`);
  }

  // Reset countdown for the sooner window (nextResetTime is ms-epoch UTC → local diff)
  const resets: number[] = [];
  if (quota.fiveHour?.nextResetTime) resets.push(quota.fiveHour.nextResetTime);
  if (quota.weekly?.nextResetTime) resets.push(quota.weekly.nextResetTime);
  if (resets.length > 0) {
    parts.push(`reset ${fmtReset(Math.min(...resets))}`);
  }

  // Label is the PROVIDER (zai), not the tier — the tier is auto-detected (A4′) and
  // surfaced via config; the badge answers "whose balance is this".
  const text = `⚡zai ${parts.join(" · ")}`;
  // The `dimmed` flag is a hint to the footer renderer; the segment itself
  // returns plain text. The footer applies theme.fg("dim", ...) when dimmed.
  return dimmed ? text : text;
}
