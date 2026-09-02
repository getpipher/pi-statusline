// src/ledger/store.ts
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import type { SessionEntry } from "../session/store.ts";

export interface LedgerLine {
  id: string;
  ts: number; // ms-epoch
  provider: string;
  model: string;
  repo: string; // cwd basename at write time; "unknown" pre-P2 / no accessor (never counts toward repoCost)
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
  cost: number;
}

export interface LedgerSnapshot {
  todayCost: number;
  last7Cost: number;
  last30Cost: number;
  repoCost: number; // all-time sum for the CURRENT repo (0 when no repo accessor / unknown)
}

export interface LedgerStoreOpts {
  filePath: string;
  now?: () => number;
  utcOffsetMinutes?: number; // fixed-offset day boundary; default = host local offset
  repo?: () => string; // current repo name (cwd basename); absent → lines record "unknown", repoCost 0
  // Live session attribution (pi exposes provider/model at session level, not per
  // entry). Absent → "unknown" for both (legacy lines never re-attributed).
  attribute?: () => { provider: string; model: string };
  warn?: (message: string) => void;
}

export interface LedgerStore {
  load(): void; // startup scan → seen-set + in-memory lines
  reconcile(entries: SessionEntry[]): number; // append unseen usage entries → count appended
  getSnapshot(): LedgerSnapshot;
  costSince(ts: number): number;
  providerTodayCost(provider: string): number;
  providerTodayTopModel(provider: string): { model: string; cost: number } | null;
}

// Fixed-offset calendar-day bucket: days since epoch in the shifted frame.
export function localDayIndex(ts: number, utcOffsetMinutes: number): number {
  return Math.floor((ts + utcOffsetMinutes * 60_000) / 86_400_000);
}

function parseLine(raw: string): LedgerLine | null {
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (typeof p.id !== "string" || typeof p.ts !== "number" || typeof p.cost !== "number") return null;
    const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
    const str = (v: unknown, fallback: string): string => (typeof v === "string" ? v : fallback);
    return {
      id: p.id,
      ts: p.ts,
      provider: str(p.provider, "unknown"),
      model: str(p.model, "unknown"),
      repo: str(p.repo, "unknown"),
      input: num(p.input),
      output: num(p.output),
      cacheRead: num(p.cacheRead),
      cacheWrite: num(p.cacheWrite),
      reasoning: num(p.reasoning),
      cost: p.cost,
    };
  } catch {
    return null;
  }
}

export function createLedgerStore(opts: LedgerStoreOpts): LedgerStore {
  const now = opts.now ?? Date.now;
  const offset = opts.utcOffsetMinutes ?? -new Date().getTimezoneOffset();
  const attribute = opts.attribute ?? (() => ({ provider: "unknown", model: "unknown" }));
  const seen = new Set<string>();
  const lines: LedgerLine[] = [];
  let loaded = false;
  let warned = false;
  let warnedAppend = false;

  const warnOnce = (message: string): void => {
    if (warned) return;
    warned = true;
    if (opts.warn) opts.warn(message);
    else console.error(`pi-statusline ledger: ${message}`);
  };

  // Append failures carry their own once-flag: a scan warning must not swallow the
  // persist warning (different causes — the render path needs the append cause).
  const warnOnceAppend = (message: string): void => {
    if (warnedAppend) return;
    warnedAppend = true;
    if (opts.warn) opts.warn(message);
    else console.error(`pi-statusline ledger: ${message}`);
  };

  function toLine(entry: SessionEntry): LedgerLine | null {
    if (!entry.id) return null;
    if (entry.type !== "message" || entry.message?.role !== "assistant") return null;
    const u = entry.message.usage;
    if (!u) return null;
    const ts = entry.timestamp && Number.isFinite(Date.parse(entry.timestamp))
      ? Date.parse(entry.timestamp)
      : now();
    return {
      id: entry.id,
      ts,
      // P1 recorded "unknown" for both; P3 wires live session attribution (opts.attribute).
      provider: attribute().provider,
      model: attribute().model,
      repo: opts.repo?.() ?? "unknown",
      input: u.input ?? 0,
      output: u.output ?? 0,
      cacheRead: u.cacheRead ?? 0,
      cacheWrite: u.cacheWrite ?? 0,
      reasoning: u.reasoning ?? 0,
      cost: u.cost?.total !== undefined && Number.isFinite(u.cost.total) ? u.cost.total : 0,
    };
  }

  return {
    load(): void {
      loaded = true;
      if (!existsSync(opts.filePath)) return;
      let raw: string;
      try {
        raw = readFileSync(opts.filePath, "utf8");
      } catch {
        warnOnce(`cannot read ${opts.filePath}`);
        return;
      }
      for (const rawLine of raw.split("\n")) {
        if (rawLine.trim() === "") continue;
        const parsed = parseLine(rawLine);
        if (!parsed) {
          warnOnce(`skipped malformed line in ${opts.filePath}`);
          continue;
        }
        seen.add(parsed.id);
        lines.push(parsed);
      }
    },

    reconcile(entries: SessionEntry[]): number {
      if (!loaded) this.load();
      let appended = 0;
      for (const entry of entries) {
        const lineItem = toLine(entry);
        if (!lineItem || seen.has(lineItem.id)) continue;
        seen.add(lineItem.id);
        lines.push(lineItem);
        try {
          mkdirSync(dirname(opts.filePath), { recursive: true });
          appendFileSync(opts.filePath, `${JSON.stringify(lineItem)}\n`, "utf8");
          appended += 1;
        } catch (err) {
          // Spec §10: reconcile runs inside the footer render — a persist failure must
          // never throw there. Fail-open: the id stays seen (no double count on retry),
          // the disk line is lost, and warnOnce carries the cause.
          warnOnceAppend(`ledger append failed for entry ${lineItem.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      return appended;
    },

    getSnapshot(): LedgerSnapshot {
      const todayIdx = localDayIndex(now(), offset);
      const byDay = new Map<number, number>();
      for (const l of lines) {
        const day = localDayIndex(l.ts, offset);
        byDay.set(day, (byDay.get(day) ?? 0) + l.cost);
      }
      const sumDays = (from: number, to: number): number => {
        let sum = 0;
        for (let d = from; d <= to; d++) sum += byDay.get(d) ?? 0;
        return sum;
      };
      // All-time total for the CURRENT repo only. Legacy/unattributed lines ("unknown")
      // and other repos never count — and an absent repo accessor (current "unknown")
      // yields 0, never a mixed-repo sum.
      const currentRepo = opts.repo?.() ?? "unknown";
      const repoCost = currentRepo === "unknown"
        ? 0
        : lines.filter((l) => l.repo === currentRepo).reduce((sum, l) => sum + l.cost, 0);
      return {
        todayCost: byDay.get(todayIdx) ?? 0,
        last7Cost: sumDays(todayIdx - 6, todayIdx),
        last30Cost: sumDays(todayIdx - 29, todayIdx),
        repoCost,
      };
    },

    costSince(ts: number): number {
      let sum = 0;
      for (const l of lines) if (l.ts >= ts) sum += l.cost;
      return sum;
    },

    providerTodayCost(provider: string): number {
      const todayIdx = localDayIndex(now(), offset);
      let sum = 0;
      for (const l of lines) {
        if (l.provider !== provider || localDayIndex(l.ts, offset) !== todayIdx) continue;
        sum += l.cost;
      }
      return sum;
    },

    providerTodayTopModel(provider: string): { model: string; cost: number } | null {
      const todayIdx = localDayIndex(now(), offset);
      const byModel = new Map<string, number>();
      for (const l of lines) {
        if (l.provider !== provider || localDayIndex(l.ts, offset) !== todayIdx) continue;
        byModel.set(l.model, (byModel.get(l.model) ?? 0) + l.cost);
      }
      let top: { model: string; cost: number } | null = null;
      for (const [model, cost] of byModel) {
        if (!top || cost > top.cost) top = { model, cost };
      }
      return top;
    },
  };
}
