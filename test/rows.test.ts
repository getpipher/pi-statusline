// test/rows.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Row, RowSnapshot } from "../src/rows/registry.ts";
import { createIdentityRow } from "../src/rows/identity.ts";
import { createAmbientRow } from "../src/rows/ambient.ts";
import { DEFAULT_CONFIG } from "../src/config.ts";
import type { SessionSnapshot } from "../src/session/store.ts";

function snap(partial: Partial<RowSnapshot>): RowSnapshot {
  return {
    now: Date.UTC(2026, 7, 30, 4, 12),
    width: 500,
    session: null as never,
    ledger: null as never,
    statuses: "",
    config: DEFAULT_CONFIG,
    ...partial,
  };
}

function session(partial: Partial<SessionSnapshot>): SessionSnapshot {
  return {
    sessionName: "v2-p1",
    repoName: "pi-statusline",
    branch: "main",
    modelId: "glm-5.2",
    provider: "zai",
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, count: 0 },
    contextTokens: null,
    contextWindow: 0,
    contextPercent: null,
    spanMs: (3 * 60 + 12) * 60_000,
    ...partial,
  };
}

function plain(frags: ReturnType<Row["render"]>): string {
  return (frags ?? []).map((f) => f.text).join("");
}

test("identity row: session name bright lead, repo dim, branch mid with ⎇, model accent", () => {
  const row = createIdentityRow();
  const frags = row.render(snap({ session: session({}) }))!;
  assert.deepEqual(frags, [
    { text: "v2-p1", color: "text" },
    { text: " pi-statusline", color: "dim" },
    { text: " ⎇ main", color: "muted" },
    { text: " · glm-5.2", color: "accent" },
  ]);
});

test("identity row: strips provider prefix and variant from model id", () => {
  const row = createIdentityRow();
  const out = plain(row.render(snap({ session: session({ modelId: "ollama/glm-5.2:cloud" }) })));
  assert.ok(out.includes(" · glm-5.2"));
});

test("identity row: omits name when unset or showSession=false; omits branch when null", () => {
  const row = createIdentityRow();
  assert.equal(plain(row.render(snap({ session: session({ sessionName: undefined }) }))), "pi-statusline ⎇ main · glm-5.2");
  const noSession = snap({ session: session({}), config: { ...DEFAULT_CONFIG, display: { ...DEFAULT_CONFIG.display, showSession: false } } });
  assert.equal(plain(row.render(noSession)), "pi-statusline ⎇ main · glm-5.2");
  assert.equal(plain(row.render(snap({ session: session({ branch: null }) }))), "v2-p1 pi-statusline · glm-5.2");
});

test("ambient row: clock, coding span, extension statuses — all dim", () => {
  const row = createAmbientRow();
  const frags = row.render(snap({ statuses: "fleet ready · memory warm", session: session({}) }))!;
  const d = new Date(Date.UTC(2026, 7, 30, 4, 12)); // same instant — local-getter (TZ-deterministic)
  const clock = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  assert.deepEqual(frags, [
    { text: clock, color: "dim" },
    { text: " · coding 3h12m", color: "dim" },
    { text: " · fleet ready · memory warm", color: "dim" },
  ]);
});

test("ambient row: clock is rendered from snapshot.now in local time", () => {
  const row = createAmbientRow();
  const d = new Date(Date.UTC(2026, 7, 30, 4, 12)); // same instant as the snap() fixture
  const expected = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const out = plain(row.render(snap({ statuses: "", session: session({}) })));
  assert.ok(out.startsWith(expected), `expected clock ${expected}, got: ${out}`);
  assert.ok(out.includes(" · coding 3h12m"));
  assert.ok(!out.endsWith(" ·")); // no dangling separator when statuses empty
});
