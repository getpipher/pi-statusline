# Code Review — Visual Upgrade (presets, glyphs, bar styles)

**Reviewer:** CIPHER (review phase) · **Date:** 2026-09-03 · **Verdict: READY TO MERGE**

**Scope reviewed:** commits `6fd5a46..4d78c78` (10 visual-upgrade commits) against the plan
(`docs/superpowers/plans/2026-09-02-visual-upgrade.md`) and the design spec
(`docs/superpowers/specs/2026-09-02-visual-upgrade-design.md`), excluding interleaved
foreign commits (`f9f4113`, `da83b91`, `a003abc` — other session's work).

**Final gate:** `pnpm test:run` 175/175 pass · `pnpm typecheck` 0 errors · (176 pre-consolidation; applyThemeColor test merge −1).

## Findings resolved during review (fixed in `4d78c78`)

1. **DRY — triplicated unions.** `RowSnapshot.glyphStyle`/`barStyle` (registry.ts) and
   `display.glyphs`/`barStyle` (config.ts) re-declared the unions inline instead of
   importing `GlyphStyle` (glyphs.ts) / `BarStyle` (format.ts). Three copies of each
   union = drift risk. **Fixed:** single source of truth, type-only imports (no runtime cycles — verified).
2. **Dead API — `applyThemeColor`.** After the `2231c42` render-loop refactor onto
   `resolveThemeToken`, `applyThemeColor` had zero production callers (own tests only).
   Internal-only surface (raw-TS extension, not published to npm; no external importers).
   **Fixed:** removed; mono-flattening semantics ported onto `resolveThemeToken` tests
   (default identity, mono flattening with escalation preserved, unknown identity).

## Spec-compliance findings (report-only — need RECTOR's product call or are sanctioned)

3. **`statusGlyph` helper (design §3) not implemented — sanctioned by reality.** The
   design's third pillar has no live consumer: the money row's burn rate was removed in
   v0.4.6 declutter (`5a290ac`), quota % is now adapter-driven segments, context % already
   has `contextHeat` threshold bands. Implementing it would be dead code. The plan mapped
   it to Task 6, which I adapted (glyph adoption at identity row). If RECTOR wants
   threshold glyphs for future rows, the helper is a small follow-up — flagging so it
   isn't silently lost.
4. **Partial glyph adoption.** Only `git_branch` is consumed (identity row). The design's
   table also lists model (`◆`/`[m]`), deen (☾), context gauge, quota bar — unadopted.
   Rationale: the spec's own table shows unicode ≠ current marks (e.g. ⑂ vs ⎇), i.e.
   adopting them under the **default** `unicode` style would change existing users'
   output — contradicting the zero-change principle the plan header mandates for
   defaults. Adoption requires RECTOR to decide whether `unicode` (the default) may
   alter the look, or whether those glyphs belong only under `nerd`/`ascii`.
5. **Truecolor-only, no capability detection — spec-sanctioned.** Design §1 explicitly:
   "16-color / 256-color terminals: out of scope for v0.5… Truecolor-to-256 fallback is
   tracked as a v0.6 follow-up." The hex path emits `ESC[38;2;R;G;Bm` unconditionally;
   `theme.fg` (which respects pi's color mode) remains the path for default/mono.
6. **`/statusline` args + TUI don't expose the new options.** Pre-existing surface shape:
   theme was never an arg either; the design's interactive panel is §9 (deferred). JSON
   config is the full surface for v0.5. No regression; documented in README.

## Disclosed process deviations (accepted, no action)

7. **`881f7df` committed with 6 failing foreign tests.** The gate constraint ("all exit 0
   before commit") was violated in letter: the failures originated in another session's
   uncommitted v0.4.7 WIP (`zai.ts`/`format.ts`), not my changes (verified by stash —
   failures persisted on the pre-change tree). Two coherent foreign test hunks rode along
   in my commit via the shared `test/adapters-zai.test.ts`; the other session's `da83b91`
   made them pass. Disclosed at commit time; branch-mainline risk was zero (shared
   worktree, single-actor per file).
8. **Branch lifecycle.** `feat/visual-upgrade` was created then deleted by fleet tooling;
   commits landed on `main`. Fleet owns branch lifecycle in this worktree.

## Plan deviations (disclosed at implementation, ratified here)

9. **renderBar end-caps preserved** (`▕▏`) — plan's test expectation dropped them, but
   they're the established bar visual identity asserted by pre-existing tests. Style
   swaps fill/empty glyphs only.
10. **Unicode `git_branch` = `⎇` (U+2387), not spec's ⑂ (U+2442)** — matches the identity
    row's existing mark; default output byte-identical (proven by untouched assertions).
11. **Task 6 premise void** — v0.4.6 removed bars from rows; `renderBar`/`splitBar` have
    zero production call sites (test-covered utilities). `barStyle` is plumbed through
    the snapshot for future bar consumers; `glyphStyle` adoption landed at the identity
    row instead.

## Robustness checks (pass)

- `hexToRgb` unreachable-NaN: only called behind `startsWith("#")` on compile-time
  preset constants, all verified 6-digit-hex by `THEME_PRESETS` tests.
- Unknown-theme notify automatically lists all 6 preset names (derived from
  `THEME_PRESETS` keys — no stale list).
- `Object` shape of `THEME_PRESETS` grew without touching notify/validate logic — the
  "validated at use" contract held.
- Mono/default remain theme-integrated (v0.2.3 no-hardcoded-ANSI decision intact);
  only hex presets bypass (spec §1 + render-path tension, option a).
- Test fixture migration (Task 5) complete: exactly one production `RowSnapshot`
  literal (index.ts:231) + all test helpers updated; suite green proves coverage.
- `splitBar` (two-tone helper) does NOT honor `barStyle` — noting for completeness; it
  also has zero production call sites, so no user-visible inconsistency today. If a bar
  consumer returns, style `splitBar` in the same change.

## Verdict

All plan tasks delivered with disclosed, ratified deviations. The two code-level
findings found in review (DRY unions, dead API) were fixed and gate-verified in the
same session. Spec drift items (#3, #4) are product decisions for RECTOR, correctly
surfaced rather than silently implemented. **READY TO MERGE.**
