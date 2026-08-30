# CC statusline (v2.27.1) — feature inventory & exact formulas

Source: local clone `~/local-dev/rz1989s/claude-code-statusline` (bash+jq; reads Claude Code stdin JSON, git, `~/.claude/projects/` JSONL transcripts). Compiled 2026-08-30 for pi-statusline parity planning. Evidence = quoted code.

## Components & semantics

| Component (line) | Data source | Formula / behavior |
|---|---|---|
| Path · model `(1M context)` · Commits · CC · SL · clock | stdin `.model.display_name`; git; version.txt; `date` | model context-size annotation from CC native context data |
| `REPO $X` | `~/.claude/projects/<project>/*.jsonl` (per-project transcript dir) | `calculate_native_repo_cost` — **all-time** cumulative cost for current repo ("Use all-time calculation (no -mtime filter)"), `native_calc.sh:205,309` |
| `30DAY / 7DAY / DAY` | same JSONL | `-mtime -31` find filter, summed by period |
| `🔥 $/hr` burn | window JSONL | `cost_per_hour = (window_cost / elapsed_minutes) × 60` — **anchored to the 5h block start**, `api_live.sh:392-433` |
| `Cache: N% hit` | window tokens | `cache_read / (cache_read + cache_write) × 100`, `cache_efficiency.sh:44-50` |
| `Est: $X (tokens)` | block projection | `projected = current + (rate_per_hour × remaining_minutes / 60)`; rate from burn; remaining = minutes to 5h block reset. "Projected cost and tokens for the current 5-hour block … help users budget", `block_projection.sh:4-6`, `api_live.sh:548-580` |
| `Ctx: 34%` | CC native context data | % used + remaining |
| Hijri + date + `Loc:` + `☕ Coding 0m/45m` | aladhan-style API/cache, IP-geo, focus session file | coding = focus timer (start/stop, config duration, history JSON) |
| Prayer strip `Fajr 04:36 ✓ · Dhuhr 11:53 (3h 45m) · …` | prayer lib (location.sh, timezone_methods.sh, reminders.sh) | all 5 prayers, ✓ past, `(h m)` countdown on next |
| `MCP:x/y` · `Native:… +N` · `Plugin:… +N` | CC stdin/native tools/plugins | CC-host concepts (no pi equivalent; pi extension statuses ≈) |
| `Commits:0` | `git log --since=<today> --oneline | wc -l` | short cache TTL, `git.sh:299` |
| `CC:` host version | CC's own version env | |
| `SL:` self version | `version.txt` + GitHub latest-check (cached, "update" indicator) | `version_info.sh` |

## Config model
File-based toggles per component (`get_*_config 'enabled' 'true'`), cache dir with TTL'd key/value entries (30s render TTL; medium/short git TTLs), render-cache per process (`/tmp/.statusline_cost_render_$$`).

## Key deltas vs pi-statusline v2 plan
1. **REPO all-time per-repo cost** — needs per-repo attribution in our ledger (`repo` field at reconcile). Not in plan → **add to P2**.
2. **Est (5h block projection)** — for pi the analog projects **z.ai quota credits** to window reset (we already have currentValue/percentage/nextResetTime) + optional $ projection. Not in plan → **add to P3** (design: zai-credit projection primary, $ secondary for non-flat providers).
3. **Burn anchor** — CC anchors burn to the 5h block; ours anchors to session span. With zai window data we can offer block-anchored burn → **P3 refinement**.
4. **Version stamps** — trivial self-version; pi host version needs accessor check → **add to P3**.
5. **Full 5-prayer strip** (CC-style) vs our next-prayer-first line → **P2 render decision: full strip** (RECTOR preference), escalation preserved (next highlighted + countdown, past ✓).
