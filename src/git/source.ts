// src/git/source.ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export interface GitSnapshot {
  dirty: boolean;
  ahead: number | null; // commits HEAD has that upstream lacks; null = no upstream
  behind: number | null;
  commitsToday: number | null; // CC formula: git log --since=<today> --oneline | wc -l
}

export interface GitSource {
  refresh(force?: boolean): void; // async fire-and-forget; never throws
  get(): GitSnapshot | null;      // sync last-good; null = no data yet / not a repo
}

export interface GitSourceOpts {
  cwd?: () => string;
  now?: () => number;
  ttlMs?: number; // default 30_000 (spec §4.1: 30s TTL)
  run?: (cwd: string, args: string[]) => Promise<string>; // test seam
  onUpdate?: () => void;
}

function formatLocalMidnight(now: number): string {
  const d = new Date(now);
  const mid = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offsetMin = -mid.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${mid.getFullYear()}-${pad(mid.getMonth() + 1)}-${pad(mid.getDate())} 00:00:00 ${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`;
}

export function createGitSource(opts: GitSourceOpts = {}): GitSource {
  const cwd = opts.cwd ?? (() => process.cwd());
  const now = opts.now ?? Date.now;
  const ttlMs = opts.ttlMs ?? 30_000;
  const run = opts.run ?? ((dir: string, args: string[]) => exec("git", args, { cwd: dir }).then((r) => r.stdout));

  let snapshot: GitSnapshot | null = null;
  let lastRefreshAt = -Infinity;
  let inFlight = false;

  async function measure(): Promise<GitSnapshot | null> {
    const dir = cwd();
    try {
      // Repo probe first: any command failing with "not a git repository" marks the
      // whole source null until the next TTL window.
      const status = await run(dir, ["status", "--porcelain"]);
      let ahead: number | null = null;
      let behind: number | null = null;
      try {
        const out = await run(dir, ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"]);
        const [a, b] = out.trim().split(/\s+/);
        ahead = Number.parseInt(a ?? "", 10);
        behind = Number.parseInt(b, 10);
        if (!Number.isFinite(ahead)) ahead = null;
        if (!Number.isFinite(behind)) behind = null;
      } catch {
        // no upstream → fragment omitted later; keep counting commits
      }
      let commitsToday: number | null = null;
      try {
        const out = await run(dir, ["rev-list", "--count", "--since", formatLocalMidnight(now()), "HEAD"]);
        const n = Number.parseInt(out.trim(), 10);
        commitsToday = Number.isFinite(n) ? n : null;
      } catch {
        // detached HEAD etc. — omit the fragment, keep the rest
      }
      return { dirty: status.trim().length > 0, ahead, behind, commitsToday };
    } catch {
      return null; // not a repo / git missing — row fragments omitted
    }
  }

  return {
    refresh(force = false) {
      if (inFlight) return;
      if (!force && now() - lastRefreshAt < ttlMs) return;
      inFlight = true;
      void measure()
        .then((s) => {
          snapshot = s;
          lastRefreshAt = now();
          opts.onUpdate?.();
        })
        .catch(() => { /* measure already returns null on failure; belt for onUpdate throws */ })
        .finally(() => { inFlight = false; });
    },
    get: () => snapshot,
  };
}
