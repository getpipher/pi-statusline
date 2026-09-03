// test/theme.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { THEME_PRESETS, resolveThemeToken, DEFAULT_THEME_NAME } from "../src/theme.ts";
import type { ColorToken } from "../src/types.ts";

const ALL_TOKENS: ColorToken[] = ["text", "muted", "dim", "accent", "warning", "error", "success", "toolTitle"];

test("default preset is identity; mono flattens hue tokens but keeps escalation", () => {
  assert.equal(resolveThemeToken("success", "default"), "success");
  assert.equal(resolveThemeToken("toolTitle", "default"), "toolTitle");
  assert.equal(resolveThemeToken("success", "mono"), "text");
  assert.equal(resolveThemeToken("toolTitle", "mono"), "text");
  assert.equal(resolveThemeToken("accent", "mono"), "text");
  assert.equal(resolveThemeToken("warning", "mono"), "warning"); // escalation preserved
  assert.equal(resolveThemeToken("error", "mono"), "error");
  assert.equal(resolveThemeToken("dim", "mono"), "dim");
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
