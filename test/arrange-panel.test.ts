// test/arrange-panel.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createArrangePanel } from "../src/tui/arrangePanel.ts";
import { createRowRegistry } from "../src/rows/registry.ts";
import { createIdentityRow } from "../src/rows/identity.ts";
import { createModelRow } from "../src/rows/model.ts";
import { createContextRow } from "../src/rows/context.ts";
import { DEFAULT_CONFIG } from "../src/config.ts";
import type { RowSnapshot } from "../src/rows/registry.ts";

function snapshot(): RowSnapshot {
  return {
    now: 0, width: 500, statuses: "", config: DEFAULT_CONFIG, deen: null, git: null,
    versions: { sl: "", pi: null }, glyphStyle: "unicode",
    session: { sessionName: "s", repoName: "r", branch: "main", modelId: "glm-5.2", provider: "zai",
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, count: 0 },
      contextTokens: 50_000, contextWindow: 200_000, contextPercent: 25, thinkingLevel: "high", spanMs: 0 },
    ledger: { todayCost: 1, last7Cost: 2, last30Cost: 3, repoCost: 0 },
  };
}

function strip(l: string): string {
  return l.replace(/\x1b\[[0-9;]*m/g, "");
}

function makePanel(initial: string[]) {
  const registry = createRowRegistry([createIdentityRow(), createModelRow(), createContextRow()]);
  let result: string[] | null = null;
  const panel = createArrangePanel({
    registry,
    snapshot: snapshot(),
    initial,
    onChange: () => {},
    onDone: (value) => { result = value; },
  });
  const render = (): string => panel.component.render(120).map(strip).join("\n");
  return { panel, render, getResult: () => result };
}

test("renders WYSIWYG preview (real renderRows of the draft) + line list + help", () => {
  const { render } = makePanel(["identity", "model+ctx"]);
  const out = render();
  assert.match(out, /PREVIEW \(live\)/);
  assert.match(out, /glm-5\.2 · high \| Ctx: 25%/, "preview = real render of the draft");
  assert.match(out, /► identity/, "selected line marker");
  assert.match(out, /model\+ctx/);
  assert.match(out, /a add · x remove · \[ move up · \] move down · enter save · esc cancel/);
});

test("handleInput: 'a' opens palette filtered to ids not on the selected line; enter adds", () => {
  const { panel, render } = makePanel(["identity"]);
  render();
  panel.component.handleInput("a"); // open palette
  let out = render();
  assert.match(out, /ADD COMPONENT/);
  assert.match(out, /model/, "model offered");
  assert.ok(!/ADD COMPONENT[\s\S]*identity →/.test(out), "identity already on line → not offered");
  panel.component.handleInput("\x1b[B"); // down → ctx (items: model, ctx, money, …)
  panel.component.handleInput("\r");     // enter = add ctx to the selected line
  out = render();
  assert.match(out, /identity\+ctx/, "ctx appended to the selected line");
  assert.ok(!/ADD COMPONENT/.test(out), "palette closed after add");
});

test("handleInput: '[' / ']' move the selected line; 'x' removes it", () => {
  const { panel, render } = makePanel(["identity", "ctx"]);
  render();
  panel.component.handleInput("\x1b[B"); // down → select ctx
  panel.component.handleInput("[");      // move ctx up
  let out = render();
  assert.ok(out.indexOf("► ctx") < out.indexOf("identity"), "ctx moved above identity");
  panel.component.handleInput("x");      // remove selected (ctx)
  out = render();
  assert.ok(!out.includes("► ctx"), "ctx line removed");
});

test("frame: DynamicBorder top + spacer, spacer + border bottom (armory-todo/fleet parity)", () => {
  const { render } = makePanel(["identity"]);
  const lines = render().split("\n");
  const border = "─".repeat(120);
  assert.equal(lines[0], border, "first line = full-width border");
  assert.equal(lines[1], "", "blank spacer under the top border");
  assert.equal(lines[lines.length - 1], border, "last line = full-width border");
  assert.equal(lines[lines.length - 2], "", "blank spacer above the bottom border");
});

test("frame is accent-colored when a theme is provided", () => {
  const registry = createRowRegistry([createIdentityRow()]);
  const theme = { fg: (_role: string, s: string) => `«${s}»` } as never;
  const panel = createArrangePanel({
    registry, snapshot: snapshot(), initial: ["identity"], theme,
    onChange: () => {}, onDone: () => {},
  });
  const out = panel.component.render(40).map(strip);
  assert.match(out[0], /^«─{40}»$/, "top border wrapped by theme accent");
  assert.match(out[out.length - 1], /^«─{40}»$/, "bottom border wrapped by theme accent");
});

test("enter saves (done with applied draft), esc cancels (done null)", () => { 
  const p1 = makePanel(["identity"]);
  p1.render();
  p1.panel.component.handleInput("\r");
  assert.deepEqual(p1.getResult(), ["identity"], "enter → applied draft");
  const p2 = makePanel(["identity"]);
  p2.render();
  p2.panel.component.handleInput("\x1b");
  assert.equal(p2.getResult(), null, "esc → null");
});
