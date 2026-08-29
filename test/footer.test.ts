// test/footer.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { composeSegments, truncateSegments } from "../src/footer.ts";
import type { StatuslineConfig } from "../src/config.ts";

const cfg: StatuslineConfig = {
  enabled: true,
  zai: { tier: "auto", pollIntervalMs: 180_000 },
  display: { showTokens: true, showContext: true, showGit: true },
};

test("composeSegments produces model + tokens + ctx + git in canonical order", () => {
  const segs = composeSegments({
    modelId: "zai/glm-5.2",
    gitBranch: "main",
    tokens: "↑1.5k ↓700",
    ctxPct: "42%",
    quota: null,
    config: cfg,
  });
  // Canonical order: [model, git, tokens, ctx, quota] — truncation relies on it
  assert.deepEqual(segs, ["glm-5.2", "main", "↑1.5k ↓700", "42%"]);
});

test("composeSegments includes quota as the LAST segment when present", () => {
  const segs = composeSegments({
    modelId: "zai/glm-5.2",
    gitBranch: "main",
    tokens: "↑1.5k ↓700",
    ctxPct: "42%",
    quota: "⚡zai 5h 1.5k/2.0k 75% · wk 1.5k/10k 15% · reset 2h55m",
    config: cfg,
  });
  assert.equal(segs[segs.length - 1], "⚡zai 5h 1.5k/2.0k 75% · wk 1.5k/10k 15% · reset 2h55m");
  assert.ok(segs[0] === "glm-5.2");
});

test("composeSegments omits git when display.showGit=false", () => {
  const cfgNoGit = { ...cfg, display: { ...cfg.display, showGit: false } };
  const segs = composeSegments({
    modelId: "zai/glm-5.2",
    gitBranch: "main",
    tokens: "↑1.5k ↓700",
    ctxPct: "42%",
    quota: null,
    config: cfgNoGit,
  });
  assert.ok(!segs.includes("main"), `no git: ${JSON.stringify(segs)}`);
});

test("composeSegments omits tokens when display.showTokens=false", () => {
  const cfgNoTok = { ...cfg, display: { ...cfg.display, showTokens: false } };
  const segs = composeSegments({
    modelId: "zai/glm-5.2",
    gitBranch: "main",
    tokens: "↑1.5k ↓700",
    ctxPct: "42%",
    quota: null,
    config: cfgNoTok,
  });
  assert.ok(!segs.some((s) => s.includes("↑")), `no tokens: ${JSON.stringify(segs)}`);
});

test("truncateSegments drops rightmost first (quota → ctx → tokens → git)", () => {
  const segs = [
    "glm-5.2",       // model — always kept (index 0)
    "main",          // git — dropped 4th
    "↑1.5k ↓700",   // tokens — dropped 3rd
    "42%",           // ctx — dropped 2nd
    "⚡zai 5h 1.5k/2.0k 75%",  // quota — dropped 1st
  ];
  // At width ~20, should drop quota
  const truncated = truncateSegments(segs, 20);
  const joined = truncated.join(" ");
  assert.ok(joined.includes("glm-5.2"), "model kept");
  assert.ok(!joined.includes("⚡"), "quota dropped");
});

test("truncateSegments is robust to missing segments (no git)", () => {
  // Canonical order minus git — pop-from-end still drops quota first, not ctx
  const segs = ["glm-5.2", "↑1.5k ↓700", "42%", "⚡zai 5h 1.5k/2.0k 75%"];
  const truncated = truncateSegments(segs, 20);
  const joined = truncated.join(" ");
  assert.ok(joined.includes("glm-5.2"), "model kept");
  assert.ok(!joined.includes("⚡"), "quota dropped first even without git");
});

test("truncateSegments always keeps model badge", () => {
  const segs = ["claude-sonnet-4", "main", "↑1.5k ↓700", "42%", "⚡zai 5h 75%"];
  const truncated = truncateSegments(segs, 5);
  const joined = truncated.join(" ");
  assert.ok(joined.includes("claude-sonnet-4"), "model kept at tiny width");
});

test("composeSegments model badge strips variant suffix (uses renderModelSegment)", () => {
  // Alignment: footer must use the canonical badge formatter — same rule as segments/model.ts.
  // "Ollama/glm-5.2:cloud" → "glm-5.2" (NOT "glm-5.2:cloud").
  const segs = composeSegments({
    modelId: "Ollama/glm-5.2:cloud",
    gitBranch: "main",
    tokens: "↑1.5k ↓700",
    ctxPct: "42%",
    quota: null,
    config: cfg,
  });
  assert.equal(segs[0], "glm-5.2", `first segment must strip the :variant suffix: ${JSON.stringify(segs)}`);
});
