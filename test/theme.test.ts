// test/theme.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { THEME_PRESETS, applyThemeColor, resolveThemeToken, DEFAULT_THEME_NAME } from "../src/theme.ts";
import type { ColorToken } from "../src/types.ts";

const ALL_TOKENS: ColorToken[] = ["text", "muted", "dim", "accent", "warning", "error", "success", "toolTitle"];

test("default preset is identity; mono flattens hue tokens but keeps escalation", () => {
  assert.equal(applyThemeColor("success", "default").color, "success");
  assert.equal(applyThemeColor("toolTitle", "default").color, "toolTitle");
  assert.equal(applyThemeColor("success", "mono").color, "text");
  assert.equal(applyThemeColor("toolTitle", "mono").color, "text");
  assert.equal(applyThemeColor("accent", "mono").color, "text");
  assert.equal(applyThemeColor("warning", "mono").color, "warning"); // escalation preserved
  assert.equal(applyThemeColor("error", "mono").color, "error");
  assert.equal(applyThemeColor("dim", "mono").color, "dim");
});

test("unknown preset falls back to default mapping and flags known:false", () => {
  const r = applyThemeColor("success", "nope");
  assert.equal(r.color, "success");
  assert.equal(r.known, false);
  assert.equal(applyThemeColor("success", "default").known, true);
  assert.ok("mono" in THEME_PRESETS && "default" in THEME_PRESETS);
});

test("gruvbox preset resolves all tokens to truecolor hex", () => {
  for (const token of ALL_TOKENS) {
    const hex = resolveThemeToken(token, "gruvbox");
    assert.match(hex, /^#[0-9a-fA-F]{6}$/, `gruvbox ${token} should be a 6-digit hex, got: ${hex}`);
  }
});

test("gruvbox accent is the expected color", () => {
  assert.equal(resolveThemeToken("accent", "gruvbox"), "#fabd2f");
});

test("tokyo-night preset resolves all tokens", () => {
  for (const token of ALL_TOKENS) {
    const hex = resolveThemeToken(token, "tokyo-night");
    assert.match(hex, /^#[0-9a-fA-F]{6}$/);
  }
});

test("pastel preset resolves all tokens", () => {
  for (const token of ALL_TOKENS) {
    assert.match(resolveThemeToken(token, "pastel"), /^#[0-9a-fA-F]{6}$/);
  }
});

test("solarized preset resolves all tokens", () => {
  for (const token of ALL_TOKENS) {
    assert.match(resolveThemeToken(token, "solarized"), /^#[0-9a-fA-F]{6}$/);
  }
});

test("default preset falls through to pi-theme (identity, not hex)", () => {
  assert.equal(resolveThemeToken("accent", DEFAULT_THEME_NAME), "accent");
});

test("unknown theme falls back to identity", () => {
  assert.equal(resolveThemeToken("success", "bogus"), "success");
});
