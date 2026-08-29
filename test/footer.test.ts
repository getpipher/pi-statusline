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

function input(overrides: Partial<Parameters<typeof composeSegments>[0]> = {}): Parameters<typeof composeSegments>[0] {
  return {
    modelId: "glm-5.2",
    gitBranch: "main",
    tokens: "↑1.5k ↓700",
    ctxPct: "42%",
    statuses: "fleet ready",
    quota: null,
    config: cfg,
    ...overrides,
  };
}

test("composeSegments produces the canonical segment order", () => {
  assert.deepEqual(
    composeSegments(input()),
    ["glm-5.2", "main", "↑1.5k ↓700", "42%", "fleet ready"],
  );
});

test("composeSegments includes quota as the last segment", () => {
  const quota = "⚡zai 5h 1.5k/2.0k 75% · wk 1.5k/10k 15% · reset 2h55m";
  const segs = composeSegments(input({ quota }));
  assert.equal(segs.at(-1), quota);
  assert.equal(segs[0], "glm-5.2");
});

test("composeSegments surfaces neighboring extension statuses", () => {
  const segs = composeSegments(input({ statuses: "fleet ready · memory warm" }));
  assert.ok(segs.includes("fleet ready · memory warm"));
  assert.equal(segs.indexOf("fleet ready · memory warm"), 4);
});

test("composeSegments omits git when display.showGit=false", () => {
  const config = { ...cfg, display: { ...cfg.display, showGit: false } };
  assert.ok(!composeSegments(input({ config })).includes("main"));
});

test("composeSegments omits tokens when display.showTokens=false", () => {
  const config = { ...cfg, display: { ...cfg.display, showTokens: false } };
  assert.ok(!composeSegments(input({ config })).some((segment) => segment.includes("↑")));
});

test("composeSegments omits context when display.showContext=false", () => {
  const config = { ...cfg, display: { ...cfg.display, showContext: false } };
  assert.ok(!composeSegments(input({ config })).includes("42%"));
});

test("truncateSegments drops quota, then statuses, before context", () => {
  const segs = ["model", "git", "tokens", "ctx", "statuses", "quota"];
  assert.deepEqual(truncateSegments(segs, 29), ["model", "git", "tokens", "ctx", "statuses"]);
  assert.deepEqual(truncateSegments(segs, 20), ["model", "git", "tokens", "ctx"]);
});

test("truncateSegments is robust to missing git", () => {
  const segs = ["glm-5.2", "↑1.5k ↓700", "42%", "fleet ready", "⚡zai 5h 75%"];
  const joined = truncateSegments(segs, 28).join(" ");
  assert.ok(joined.includes("glm-5.2"));
  assert.ok(!joined.includes("⚡"));
});

test("truncateSegments filters empty strings and always keeps the model badge", () => {
  assert.deepEqual(truncateSegments(["claude-sonnet-4", "", "main"], 5), ["claude-sonnet-4"]);
});

test("composeSegments uses the canonical model formatter", () => {
  assert.equal(composeSegments(input({ modelId: "Ollama/glm-5.2:cloud" }))[0], "glm-5.2");
});
