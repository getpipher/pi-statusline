// test/config.test.ts
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { loadConfig, saveConfig, DEFAULT_CONFIG } from "../src/config.ts";
import { KNOWN_ROW_IDS } from "../src/types.ts";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "pi-sl-cfg-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

test("DEFAULT_CONFIG has expected shape", () => {
  assert.deepEqual(DEFAULT_CONFIG, {
    enabled: true,
    zai: { tier: "auto", pollIntervalMs: 180_000 },
    deen: { city: "Jakarta", country: "Indonesia", method: "auto", escalateMinutes: 30 },
    display: { rows: [...KNOWN_ROW_IDS], bars: true, showTokens: true, showContext: true, showGit: true, showSession: true, showVersions: false, theme: "default", glyphs: "unicode", barStyle: "blocks" },
    providers: { openrouter: { enabled: true, pollIntervalMs: 600_000 } },
  });
});

test("loadConfig returns defaults when file missing", () => {
  const { config } = loadConfig(join(tmpDir, "pi-statusline.json"));
  assert.deepEqual(config, DEFAULT_CONFIG);
});

test("loadConfig returns defaults for literal JSON null", () => {
  const path = join(tmpDir, "pi-statusline.json");
  writeFileSync(path, "null");
  assert.deepEqual(loadConfig(path).config, DEFAULT_CONFIG);
});

test("loadConfig reads a valid file", () => {
  const path = join(tmpDir, "pi-statusline.json");
  writeFileSync(path, JSON.stringify({
    enabled: false,
    zai: { tier: "pro", pollIntervalMs: 60_000 },
    display: { showTokens: false, showContext: true, showGit: false, showSession: true },
  }));
  const { config: cfg } = loadConfig(path);
  assert.equal(cfg.enabled, false);
  assert.equal(cfg.zai.tier, "pro");
  assert.equal(cfg.zai.pollIntervalMs, 60_000);
  assert.equal(cfg.display.showTokens, false);
  assert.equal(cfg.display.showGit, false);
  assert.equal(cfg.display.showSession, true);
});

test("loadConfig merges defaults for missing keys", () => {
  const path = join(tmpDir, "pi-statusline.json");
  writeFileSync(path, JSON.stringify({ enabled: false }));
  const { config: cfg } = loadConfig(path);
  assert.equal(cfg.enabled, false);
  assert.equal(cfg.zai.tier, "auto");         // defaulted
  assert.equal(cfg.zai.pollIntervalMs, 180_000); // defaulted
  assert.equal(cfg.display.showTokens, true);  // defaulted
  assert.equal(cfg.display.showSession, true); // defaulted
});

test("loadConfig rejects invalid tier value", () => {
  const path = join(tmpDir, "pi-statusline.json");
  writeFileSync(path, JSON.stringify({ zai: { tier: "invalid" } }));
  assert.throws(() => loadConfig(path), /tier must be/);
});

test("display.showVersions lenient boolean, defaults false (showTokens precedent)", () => {
  const defPath = join(tmpDir, "versions-default.json");
  writeFileSync(defPath, JSON.stringify({}));
  assert.equal(loadConfig(defPath).config.display.showVersions, false);
  const onPath = join(tmpDir, "versions-on.json");
  writeFileSync(onPath, JSON.stringify({ display: { showVersions: true } }));
  assert.equal(loadConfig(onPath).config.display.showVersions, true);
  // non-boolean → ignored, default retained (lenient, showTokens pattern)
  const badPath = join(tmpDir, "versions-bad.json");
  writeFileSync(badPath, JSON.stringify({ display: { showVersions: "yes" } }));
  assert.equal(loadConfig(badPath).config.display.showVersions, false);
});

test("saveConfig writes valid JSON readable by loadConfig", () => {
  const path = join(tmpDir, "pi-statusline.json");
  const cfg = { ...DEFAULT_CONFIG, enabled: false };
  saveConfig(path, cfg);
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  assert.equal(parsed.enabled, false);
  // Round-trip
  const { config: reloaded } = loadConfig(path);
  assert.equal(reloaded.enabled, false);
});

// ── v2: rows/bars/sparkline + back-compat + unknown-row reporting ──

test("v2: defaults include the full canonical row order and gates on", () => {
  const path = join(tmpDir, "pi-statusline.json");
  writeFileSync(path, JSON.stringify({}));
  const { config, unknownRows } = loadConfig(path);
  assert.deepEqual(config.display.rows, [...KNOWN_ROW_IDS]);
  assert.equal(config.display.bars, true);
  assert.deepEqual(unknownRows, []);
});

test("v2: display.rows reorders and omits rows", () => {
  const path = join(tmpDir, "pi-statusline.json");
  writeFileSync(path, JSON.stringify({ display: { rows: ["money", "identity"] } }));
  const { config } = loadConfig(path);
  assert.deepEqual(config.display.rows, ["money", "identity"]);
});

test("v2: unknown display.rows ids are dropped and reported, known-unregistered (deen) is not", () => {
  const path = join(tmpDir, "pi-statusline.json");
  writeFileSync(path, JSON.stringify({ display: { rows: ["identity", "moneny", "deen", "nope"] } }));
  const { config, unknownRows } = loadConfig(path);
  assert.deepEqual(config.display.rows, ["identity", "deen"]);
  assert.deepEqual(unknownRows, ["moneny", "nope"]);
});

test("v2: non-string or non-array rows fall back to defaults", () => {
  const path = join(tmpDir, "pi-statusline.json");
  writeFileSync(path, JSON.stringify({ display: { rows: "identity", bars: "yes" } }));
  const { config } = loadConfig(path);
  assert.deepEqual(config.display.rows, [...KNOWN_ROW_IDS]);
  assert.equal(config.display.bars, true);
});

test("v1 back-compat: a v1 file (no rows/bars) loads cleanly with defaults merged", () => {
  const path = join(tmpDir, "pi-statusline.json");
  writeFileSync(path, JSON.stringify({
    enabled: true,
    zai: { tier: "pro", pollIntervalMs: 60_000 },
    display: { showTokens: false, showContext: true, showGit: true },
  }));
  const { config: cfg, unknownRows } = loadConfig(path);
  assert.equal(cfg.zai.tier, "pro");
  assert.equal(cfg.zai.pollIntervalMs, 60_000);
  assert.equal(cfg.display.showTokens, false);
  assert.deepEqual(cfg.display.rows, [...KNOWN_ROW_IDS]);
  assert.deepEqual(unknownRows, []);
});

// ── v2.1: deen section ──

test("v2.1: deen defaults and back-compat (files without deen)", () => {
  const path = join(tmpDir, "pi-statusline.json");
  writeFileSync(path, JSON.stringify({}));
  const { config } = loadConfig(path);
  assert.deepEqual(config.deen, { city: "Jakarta", country: "Indonesia", method: "auto", escalateMinutes: 30 });
});

test("v2.1: deen section parses; escalateMinutes guarded positive; city auto allowed", () => {
  const path = join(tmpDir, "pi-statusline.json");
  writeFileSync(path, JSON.stringify({ deen: { city: "auto", country: "Singapore", method: "11", escalateMinutes: -5 } }));
  const { config } = loadConfig(path);
  assert.deepEqual(config.deen, { city: "auto", country: "Singapore", method: "11", escalateMinutes: 30 });
});

test("providers.openrouter: defaults enabled/600s; lenient parses (deen block precedent)", () => {
  const defPath = join(tmpDir, "or-default.json");
  writeFileSync(defPath, JSON.stringify({}));
  assert.deepEqual(loadConfig(defPath).config.providers, { openrouter: { enabled: true, pollIntervalMs: 600_000 } });
  const onPath = join(tmpDir, "or-on.json");
  writeFileSync(onPath, JSON.stringify({ providers: { openrouter: { enabled: false, pollIntervalMs: 120_000 } } }));
  const cfg = loadConfig(onPath).config;
  assert.equal(cfg.providers.openrouter.enabled, false);
  assert.equal(cfg.providers.openrouter.pollIntervalMs, 120_000);
  // lenient: wrong types ignored, defaults retained
  const badPath = join(tmpDir, "or-bad.json");
  writeFileSync(badPath, JSON.stringify({ providers: { openrouter: { enabled: "yes", pollIntervalMs: -5 } } }));
  const bad = loadConfig(badPath).config.providers.openrouter;
  assert.equal(bad.enabled, true);
  assert.equal(bad.pollIntervalMs, 600_000);
});

test("display.theme: defaults \"default\", lenient string passthrough (validated at use)", () => {
  const defPath = join(tmpDir, "theme-default.json");
  writeFileSync(defPath, JSON.stringify({}));
  assert.equal(loadConfig(defPath).config.display.theme, "default");
  const monoPath = join(tmpDir, "theme-mono.json");
  writeFileSync(monoPath, JSON.stringify({ display: { theme: "mono" } }));
  assert.equal(loadConfig(monoPath).config.display.theme, "mono");
  // stored verbatim even when unknown — validation happens at use (unknown-row precedent)
  const oddPath = join(tmpDir, "theme-odd.json");
  writeFileSync(oddPath, JSON.stringify({ display: { theme: "nope" } }));
  assert.equal(loadConfig(oddPath).config.display.theme, "nope");
  // non-string ignored, default retained
  const badPath = join(tmpDir, "theme-bad.json");
  writeFileSync(badPath, JSON.stringify({ display: { theme: 5 } }));
  assert.equal(loadConfig(badPath).config.display.theme, "default");
});

test("display.glyphs defaults unicode, accepts nerd/ascii, lenient on wrong type", () => {
  const defPath = join(tmpDir, "glyphs-default.json");
  writeFileSync(defPath, JSON.stringify({}));
  assert.equal(loadConfig(defPath).config.display.glyphs, "unicode");
  const nerdPath = join(tmpDir, "glyphs-nerd.json");
  writeFileSync(nerdPath, JSON.stringify({ display: { glyphs: "nerd" } }));
  assert.equal(loadConfig(nerdPath).config.display.glyphs, "nerd");
  const asciiPath = join(tmpDir, "glyphs-ascii.json");
  writeFileSync(asciiPath, JSON.stringify({ display: { glyphs: "ascii" } }));
  assert.equal(loadConfig(asciiPath).config.display.glyphs, "ascii");
  const badPath = join(tmpDir, "glyphs-bad.json");
  writeFileSync(badPath, JSON.stringify({ display: { glyphs: 42 } }));
  assert.equal(loadConfig(badPath).config.display.glyphs, "unicode");
});

test("display.barStyle defaults blocks, accepts rounded/dots/shaded, lenient on wrong type", () => {
  const defPath = join(tmpDir, "bar-default.json");
  writeFileSync(defPath, JSON.stringify({}));
  assert.equal(loadConfig(defPath).config.display.barStyle, "blocks");
  const dotsPath = join(tmpDir, "bar-dots.json");
  writeFileSync(dotsPath, JSON.stringify({ display: { barStyle: "dots" } }));
  assert.equal(loadConfig(dotsPath).config.display.barStyle, "dots");
  const badPath = join(tmpDir, "bar-bad.json");
  writeFileSync(badPath, JSON.stringify({ display: { barStyle: true } }));
  assert.equal(loadConfig(badPath).config.display.barStyle, "blocks");
});
