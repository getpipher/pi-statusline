# pi-statusline v2 — Editorial Dashboard Design

**Date:** 2026-08-30 · **Status:** Approved design (brainstorming output, RECTOR sign-off pending on this file) · **Predecessor:** [2026-08-12-pi-statusline-design.md](2026-08-12-pi-statusline-design.md) (v1, shipped as v0.1.0–v0.1.1)
**Baseline to beat:** `~/local-dev/rz1989s/claude-code-statusline` v2.27 (CC statusline — 8-line render captured live during brainstorming)
**Companion artifacts:** `.superpowers/brainstorm/37499-1788038123/content/` (layout-direction.html, editorial-dashboard.html — approved mockups)

---

## 1. Goals & Non-Goals

**Goals**
1. Full-dashboard footer for pi: multi-line, information-dense, **hierarchical** — beat the CC statusline's flat presentation (its weakness: every component equally weighted, `│` separators end-to-end, emoji width jitter, no data visualization, deen block buried at line 6).
2. Provider-pluggable by architecture: the same skeleton serves z.ai, OpenRouter, Ollama, or anything pi can drive — rows swap via adapter, everything else untouched.
3. Universal money intelligence from pi's **real** per-message cost data (no maintained pricing tables — the structural advantage a TS in-process extension has over CC's bash+jq stdin model).
4. The deen row as a first-class citizen with **context-sensitive escalation** near prayer times (RECTOR decision — the row breathes with the day).
5. Ship in phases; every phase is a released npm version.

**Non-Goals**
- No pricing tables maintained by us (pi computes `cost.total` per provider natively).
- No vim-mode / bedrock-model / CC-agent components (CC-host-specific, pi has no equivalent).
- No Nerd Font requirement — block bars (`█░▏`), `⎇`, `·`, `⚡` are the floor; NF glyphs are optional enhancement detected at runtime.
- No wellness/focus nudge features (posture/hydration prompts are not a footer's job — revisit only on explicit RECTOR request).
- No interactive TUI panel in v2 scope (still deferred from v1; notify-based `/statusline` commands continue).

---

## 2. Locked Decisions (brainstorming, do not re-litigate)

| # | Decision | Rationale |
|---|---|---|
| D1 | **Editorial Dashboard hybrid** — C's labeled-row skeleton + B's editorial skin | C's rows scale to any component count (CC's 37 components are row-based too); B's typography hierarchy is what beats CC's flatness. Approved over pure-B and pure-C via rendered three-provider proof. |
| D2 | **Phased delivery** (d) — P1 engine+money, P2 deen, P3 environment+adapters | Each phase ships; value lands incrementally. |
| D3 | **Context-sensitive deen row** (option B) | Countdown always readable; strip escalates as adhan approaches. |
| D4 | **Universal `$` row** from pi-native cost + **provider adapter contract** for quota/credits rows | `$` works identically for every provider; only quota rows are provider-specific. zai's console-API quota remains our moat. |
| D5 | **Session name is the headline** | RECTOR's missing feature; promoted to v1 early (v0.1.1 shipped `display.showSession` segment, 60/60 tests). v2 keeps it as the identity row's lead. |
| D6 | **Row budget: fixed registry (6 rows max), order/disable configurable** | Solved the "5–6 vs CC-style 1–9" question: rows are registered modules; `display.rows` reorders/omits, never invents. |
| D7 | **OpenRouter adapter scope: credits row first** (credits left / today / top-model), breakdown later | RECTOR's default is zai; OR serves "other users" + occasional use. |
| D8 | **Multi-line via `setFooter` render returning `string[]`** | Already supported by pi's footer contract (v1 returns `[line]`); verified in-repo. |

---

## 3. Baseline Being Beaten (captured 2026-08-29, mock session, Catppuccin Mocha)

```
~/local-dev/rz1989s/claude-code-statusline (main) ✅
🎵 Sonnet 5 │ Commits:0 │ CC:2.1.216 │ SL:2.27.1 │ 🕐 04:12
REPO $302.12 │ 30DAY $0.00 │ 7DAY $0.00 │ DAY $0.00
🔥$0.00/hr │ Cache: 0% hit │ Est: $0.00 │ Ctx: 34%
                                        ← blank spacer
🕌 17 Rabi' al-awwal 1448 🌖 │ Aug 30 2026 │ 📍 Loc: Jakarta │ ☕ Coding 0m/45m
Fajr 04:36 (24m) │ Dhuhr 11:53 │ Asr 15:11 │ Maghrib 17:52 │ Isha 19:02
MCP:26/26 │ Plugin:session-report +25
```

**Our wins:** typographic hierarchy (bright/mid/dim/accent), real bars + sparkline, honest local cost data, deen row with state, provider adapters, in-process speed (zero spawn per render), no pricing-table rot.

---

## 4. Architecture — four layers

### 4.1 Sources (async + cached; the render path NEVER awaits)

| Source | Data | Freshness |
|---|---|---|
| `SessionStore` | wraps `ctx.sessionManager` — entries, `getSessionName()`, cwd/repo path, model/provider | live (pull per render) |
| `LedgerStore` | persistent spend ledger (§7) → session/day/7d/30d totals, burn rate, sparkline | reconcile every tick |
| `GitSource` | branch, dirty count, ahead/behind, commits-today (branch P1; rest P3) | event-driven (branch change) + 30s TTL |
| `DeenSource` | prayer times + hijri (aladhan API), countdown math | 24h cache, city from config |
| `ProviderAdapter` (per §6) | quota/credits rows | adapter-defined (zai: 3 min, unchanged) |

### 4.2 Row registry

Ordered descriptors `{ id, priority, render(snapshot): string|null }`. `null` → row omitted (source unavailable/failed). Display order = `display.rows` config (subset/reorder of registry). Width constraint drops **whole rows by priority** (retention tiers: identity/ctx/deen = 1, money/quota = 2, ambient = 3); equal priority ties break by reverse display order (later row drops first — quota before money). Then trims a row's tail fragments as last resort. Fragment/row logic unit-tested as a drop matrix.

### 4.3 Render (editorial skin)

Brightness tokens from pi theme only (`bright`→`text`, `mid`→`muted`, `dim`→`dim`, `accent`) — same mapping across rows. Bars: `▕███████░░░░░░░▏` 10-cell block bars. Labels in dim lowercase (`ctx`, `$`, `zai`, `deen`, `or`); values mid; headline values bright; deen escalation tints per §8. `render(width): string[]` stays **synchronous, budget <1ms** — sources mutate stores off-path, then `tui.requestRender()`.

### 4.4 Ticker

One 30 s `unref()`'d interval: deen countdown + escalation, burn-rate recompute, `LedgerStore.reconcile()`, statuses re-pull (fixes v1's documented statuses-refresh gap). `unref()` mandatory (v1 print-mode lesson); disposed with the footer.

---

## 5. Row specs (final render targets)

```
statusline-v2 — ~/local-dev/getpipher/pi-statusline ⎇ main · glm-5.3-flash     (identity)
ctx  ▕███████░░░░░░░▏ 34%  68k/200k · ↑48k ↓6.2k · cache 62%                   (context)
$    1.24 sess · 8.40 day · 31.20 7d · 118.75 30d  ▁▂▃▅▃▂ $2.10/hr            (money)
zai  ▕██████████░░░▏ 75%  1.5k/2.0k 5h · wk 12% · reset 2h55m                  (quota, adapter)
deen Dhuhr 11:53 in 2h41m · Fajr ✓ · 17 Rabīʿ al-awwal 1448 · Jakarta          (deen, P2)
MCP 26/26 · 04:12 · coding 3h12m                                               (ambient, dim)
```

- **identity** (P1): session name bright-bold lead · repo basename dim · `⎇ branch` (+ `*` dirty, `↑n ↓n` ahead/behind P3) · model name.
- **ctx** (P1): 10-cell bar (theme-safe: `warning` tint ≥70%, `error` ≥90%), tokens ↑↓, cache-hit % (`cacheRead/(cacheRead+input)` over session entries).
- **money** (P1): sess/day/7d/30d from ledger · 7-day sparkline (7 cells `▁▂▃▄▅▆▇` scaled to max day) · `$X.XX/hr` = session cost over active-session wall time (min 2 usage entries, else `—`).
- **quota** (P1 for zai, P3 for openrouter): adapter-rendered; dimmed when provider inactive (v1 A5 behavior preserved).
- **deen** (P2): next prayer countdown always readable; full strip escalates (§8); past prayers `✓`; hijri from aladhan response; city label.
- **ambient** (P1): clock · coding time (session span) · MCP x/y (P3 — only if pi exposes an accessor; else permanently omitted)

---

## 6. Provider adapter contract

```ts
interface ProviderRowAdapter {
  id: string;                                  // "zai" | "openrouter"
  matches(provider: string | undefined): boolean;
  fetch(store: StoreHandle): Promise<AdapterData | null>;  // null = row omitted
  render(data: AdapterData, dim: boolean): string;         // one row line, label-first
}
```

- **ZaiAdapter** — migration of v1's poller: same endpoint `GET https://api.z.ai/api/monitor/usage/quota/limit`, same key path (`~/.pi/agent/auth.json` → `zai.key`, never logged), 3-min poll, tier auto-detect, `/statusline refresh` unchanged. Render format preserved (`zai ▕bar▏ 75% 1.5k/2.0k 5h · wk 12% · reset 2h55m`).
- **OpenRouterAdapter** (P3) — `GET https://openrouter.ai/api/v1/credits` (Bearer; key from `auth.json` `openrouter.key` if present), 10-min poll: `or $87.20 credits left · $12.80 today · top: opus-4.6 $9.10`. Failure → row omitted silently.
- **No adapter** (Ollama etc.) → quota row absent; `$` row still honest (`$0.00` local inference).
- Registry is open: shipping an adapter = implementing the interface + one registry entry.

---

## 7. LedgerStore (persistent spend)

- **File:** `~/.pi/agent/pi-statusline/ledger.jsonl` (alongside `pi-statusline.json`; survives cache cleaning; gitignored by nature of location).
- **Line:** `{"id":"<session-entry-id>","ts":1693399200000,"provider":"zai","model":"glm-5.2","input":1234,"output":567,"cacheRead":890,"cacheWrite":0,"reasoning":12,"cost":0.00123}`
- **Reconcile pattern (idempotent by construction, no pi event dependency):** every tick + on session start, diff `getEntries()` usage-bearing entry ids against the in-memory seen-set (seeded by one startup scan); append unseen lines. Restart-safe, double-count impossible.
- **Aggregation on read:** group by local-timezone calendar day; day/7d/30d sums; sparkline = last 7 daily sums. Ledger is tiny (thousands of lines/yr) — no compaction needed.
- **Day boundary:** local timezone (RECTOR SGT). Tested with fixed-offset fixtures.

---

## 8. Deen design (P2)

- **API:** aladhan.com `GET /v1/timingsByCity?city=Jakarta&country=Indonesia&method=...` (returns all 5 timings + hijri date in one response). **24 h cache** in `~/.pi/agent/pi-statusline/deen-cache.json` keyed by city+method+date.
- **Location resolution:** config `deen.city` (default `Jakarta`) → P2 adds IP geolocation fallback (cached 7 d) when city unset; manual config always wins.
- **Escalation (brightness is a pure function of `now` vs timetable — unit-tested boundaries):**
  | Time to next prayer | Row state |
  |---|---|
  | > 30 min | dim labels, countdown value in `text` (always readable) |
  | ≤ 30 min | whole strip to `text` |
  | ≤ 10 min | countdown + prayer name in `accent` |
  | ≤ 2 min | entire strip `accent` |
  | during 10 min after adhan | just-started prayer highlighted, `· adhan` marker |
- **Render:** `deen Dhuhr 11:53 in 2h41m · Fajr ✓ · 17 Rabīʿ al-awwal 1448 · Jakarta` (next prayer first, countdown `in Xh Ym`).
- Fetch failure → row omitted (never blocks footer); stale cache served with `· stale 4m` marker (§10).

---

## 9. Config schema (v2)

```json
{
  "enabled": true,
  "display": {
    "rows": ["identity", "ctx", "money", "quota", "deen", "ambient"],
    "bars": true,
    "sparkline": true,
    "showTokens": true, "showContext": true, "showGit": true, "showSession": true
  },
  "zai": { "tier": "auto", "pollIntervalMs": 180000 },
  "providers": { "openrouter": { "enabled": true } },
  "deen": { "city": "Jakarta", "method": "auto", "escalateMinutes": 30 }
}
```

- Back-compat: v1 files load cleanly (defaults merge; unknown keys ignored). v1 `display.*` booleans keep working as row-internal toggles (e.g. `showTokens` hides the ↑↓ fragment inside the ctx row); `rows` controls row presence/order independently.
- `display.rows` entries not in the registry are dropped with a one-time notify (surfaces typos — fixes v1's silent-revert lesson for pollIntervalMs).
- `/statusline` v2 additions: `rows <id[,id...]>`, `deen <city>`; existing `refresh|on|off|tier` unchanged. Panel still deferred.

---

## 10. Error handling

- Every external fetch: 5 s timeout, failure → `null` (row omitted) or **last-good cache** with `· stale <n>m` suffix; never throws into the render path (v1 T3 lesson, institutionalized).
- Ledger writes: append-only; a malformed line is skipped on scan (warn once), never fatal.
- Unknown `display.rows` ids: dropped + one-time notify.
- Ticker/pollers: `.unref()` + disposed with footer; no timers outlive dispose.

## 11. Testing strategy

- **Unit:** ledger reconcile/dedupe/day-boundary (fixed-offset tz fixtures) · escalation boundary table (30/10/2/0, adhan window) · adapter conformance (matches/fetch-fail/render-dim) · row drop matrix (priority + width) · bar/sparkline formatters · config back-compat.
- **Integration:** wiring harness drives multi-line render across provider swaps (extends v1's index-wiring pattern) · zai→anthropic→no-adapter matrix · `/statusline` command surface.
- **Perf:** render() sync budget asserted with a fixture snapshot (<1 ms budget checked in CI as a loose upper bound, e.g. <50 ms wall incl. framework).
- TDD per module; `pnpm test:run` gate; tag → release.yml → mirror as today.

## 12. Phases

| Phase | Release | Contents |
|---|---|---|
| **P1** | v0.2.0 | Row registry + multi-line render + responsive drop matrix + ticker · SessionStore · LedgerStore (§7) · identity/ctx/money/ambient rows · ZaiAdapter migration (format preserved) · config v2 + back-compat |
| **P2** | v0.3.0 | DeenSource (aladhan, 24 h cache, city config) · deen row + escalation (§8) · hijri · IP-geo fallback · `deen` config + `/statusline deen` |
| **P3** | v0.4.0 | GitSource upgrades (dirty, commits-today, ahead/behind) · OpenRouterAdapter (§6) · MCP row (accessor verified during P3; else stays omitted) · named themes (palette presets over the 4 brightness tokens) · `rows` command |

---

## 13. pi runtime ground truths (verified — code to these, do not re-derive)

- `ctx.model = { id, provider, ... }` — **separate fields**; real zai session: provider `"zai"`, id `"glm-5.2"` (no slash).
- `ctx.sessionManager.getSessionName(): string | undefined` (verified 2026-08-29 in pi 0.84.4 `session-manager.d.ts`); `getEntries()` = ALL entries incl. assistant `usage` — native footer uses it too; `getBranch()` truncates after branch points — never for totals.
- `ctx.getContextUsage() = { tokens: number|null, contextWindow: number, percent: number|null }`.
- `setFooter` factory returns `{ render(width): string[], dispose, invalidate }` — **multi-line is native**.
- `footerData`: `getGitBranch()`, `getExtensionStatuses(): ReadonlyMap<string,string>`, `onBranchChange(cb)`.
- Assistant usage shape: `{ input, output, cacheRead, cacheWrite, reasoning, totalTokens, cost: {…, total} }` (real zai capture).
- zai quota API (verified 200): `GET https://api.z.ai/api/monitor/usage/quota/limit`, Bearer = inference key (`auth.json` → `zai.key`); `limits[]` unit:3 = 5 h, unit:6 = weekly; `nextResetTime` ms-epoch UTC; `level` = lite|pro|max. Zero credit cost.
- Timers in extensions MUST `.unref()` (pi `-p` print mode hangs otherwise).
- v1 lesson: gitconfig `tag.gpgSign=true` — tag with `git -c tag.gpgSign=false tag -a vX -m …` in CI-less shells.

## 14. References

- CC statusline repo: `~/local-dev/rz1989s/claude-code-statusline` (AGENTS.md = capability map; live render captured in §3)
- Mockups: `.superpowers/brainstorm/37499-1788038123/content/` (approved Editorial Dashboard proofs, 3 provider scenarios)
- v1 design: [2026-08-12-pi-statusline-design.md](2026-08-12-pi-statusline-design.md) · v1 plan: [../plans/2026-08-12-pi-statusline-v1.md](../plans/2026-08-12-pi-statusline-v1.md)
- Memory: `~/.pi/agent/memory/-Users-rector-local-dev-getpipher-pi-statusline/pi-runtime-shapes-and-quota-api.md`
- OpenRouter credits endpoint: `https://openrouter.ai/api/v1/credits` (Bearer key) · Prayer: `https://aladhan.com/prayer-times-api` (timingsByCity; hijri included)
