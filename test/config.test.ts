// test/config.test.ts
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { loadConfig, saveConfig, DEFAULT_CONFIG } from "../src/config.ts";

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
    display: { showTokens: true, showContext: true, showGit: true },
  });
});

test("loadConfig returns defaults when file missing", () => {
  const cfg = loadConfig(join(tmpDir, "pi-statusline.json"));
  assert.deepEqual(cfg, DEFAULT_CONFIG);
});

test("loadConfig returns defaults for literal JSON null", () => {
  const path = join(tmpDir, "pi-statusline.json");
  writeFileSync(path, "null");
  assert.deepEqual(loadConfig(path), DEFAULT_CONFIG);
});

test("loadConfig reads a valid file", () => {
  const path = join(tmpDir, "pi-statusline.json");
  writeFileSync(path, JSON.stringify({
    enabled: false,
    zai: { tier: "pro", pollIntervalMs: 60_000 },
    display: { showTokens: false, showContext: true, showGit: false },
  }));
  const cfg = loadConfig(path);
  assert.equal(cfg.enabled, false);
  assert.equal(cfg.zai.tier, "pro");
  assert.equal(cfg.zai.pollIntervalMs, 60_000);
  assert.equal(cfg.display.showTokens, false);
  assert.equal(cfg.display.showGit, false);
});

test("loadConfig merges defaults for missing keys", () => {
  const path = join(tmpDir, "pi-statusline.json");
  writeFileSync(path, JSON.stringify({ enabled: false }));
  const cfg = loadConfig(path);
  assert.equal(cfg.enabled, false);
  assert.equal(cfg.zai.tier, "auto");         // defaulted
  assert.equal(cfg.zai.pollIntervalMs, 180_000); // defaulted
  assert.equal(cfg.display.showTokens, true);  // defaulted
});

test("loadConfig rejects invalid tier value", () => {
  const path = join(tmpDir, "pi-statusline.json");
  writeFileSync(path, JSON.stringify({ zai: { tier: "invalid" } }));
  assert.throws(() => loadConfig(path), /tier must be/);
});

test("saveConfig writes valid JSON readable by loadConfig", () => {
  const path = join(tmpDir, "pi-statusline.json");
  const cfg = { ...DEFAULT_CONFIG, enabled: false };
  saveConfig(path, cfg);
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  assert.equal(parsed.enabled, false);
  // Round-trip
  const reloaded = loadConfig(path);
  assert.equal(reloaded.enabled, false);
});
