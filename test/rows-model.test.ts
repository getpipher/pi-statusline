// test/rows-model.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Row, RowSnapshot } from "../src/rows/registry.ts";
import { createModelRow } from "../src/rows/model.ts";
import { DEFAULT_CONFIG } from "../src/config.ts";
import type { SessionSnapshot } from "../src/session/store.ts";

function snap(partial: Partial<RowSnapshot>): RowSnapshot {
  return {
    now: 0,
    width: 500,
    session: null as never,
    ledger: null as never,
    statuses: "",
    config: DEFAULT_CONFIG,
    deen: null,
    git: null,
    versions: { sl: "", pi: null },
    glyphStyle: "unicode",
    barStyle: "blocks",
    ...partial,
  };
}

function session(partial: Partial<SessionSnapshot>): SessionSnapshot {
  return {
    sessionName: undefined, repoName: "r", branch: null, modelId: "glm-5.2", provider: "zai",
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, count: 0 },
    contextTokens: null, contextWindow: 0, contextPercent: null, thinkingLevel: "high", spanMs: 0,
    ...partial,
  };
}

test("model row: bare model lead (own-line form, no leading separator) + thinking at detail>=1", () => {
  const row = createModelRow();
  const d2 = row.render(snap({ session: session({}) }), 2)!;
  assert.deepEqual(d2, [
    { text: "glm-5.2", color: "accent" },
    { text: " · high", color: "dim" },
  ]);
  const d1 = row.render(snap({ session: session({}) }), 1)!;
  assert.deepEqual(d1, [
    { text: "glm-5.2", color: "accent" },
    { text: " · high", color: "dim" },
  ]);
  const d0 = row.render(snap({ session: session({}) }), 0)!;
  assert.deepEqual(d0, [{ text: "glm-5.2", color: "accent" }]);
});

test("model row: nerd model glyph, unicode default bare", () => {
  const row = createModelRow();
  const nerd = plain(row.render(snap({ session: session({}), glyphStyle: "nerd" }), 1)!);
  assert.ok(nerd.startsWith("\uf085 glm-5.2"), nerd);
  const uni = plain(row.render(snap({ session: session({}) }), 1)!);
  assert.ok(uni.startsWith("glm-5.2"));
});

test("model row: priority 1 (identity-class, never dropped); no-model still renders", () => {
  const row = createModelRow();
  assert.equal(row.priority, 1);
  const frags = row.render(snap({ session: session({ modelId: undefined, thinkingLevel: "off" }) }), 1)!;
  assert.deepEqual(frags, [
    { text: "no-model", color: "accent" },
    { text: " · off", color: "dim" },
  ]);
});

function plain(frags: ReturnType<Row["render"]>): string {
  return (frags ?? []).map((f) => f.text).join("");
}
