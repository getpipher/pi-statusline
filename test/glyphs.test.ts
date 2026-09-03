// test/glyphs.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { getGlyph, GLYPH_TABLES } from "../src/glyphs.ts";

test("nerd style returns Nerd Font glyphs", () => {
  assert.ok(getGlyph("git_branch", "nerd").length > 0);
  assert.ok(getGlyph("model", "nerd").length > 0);
});

test("unicode style returns fallback glyphs", () => {
  assert.ok(getGlyph("git_branch", "unicode").length > 0);
});

test("ascii style returns ASCII-only glyphs", () => {
  const g = getGlyph("git_branch", "ascii");
  assert.match(g, /^[a-zA-Z_:\[\]]+$/, "ascii glyphs must be ASCII");
});

test("unknown segment returns empty string", () => {
  assert.equal(getGlyph("nonexistent", "nerd"), "");
});

test("every style has the same segment keys", () => {
  const nerdKeys = Object.keys(GLYPH_TABLES.nerd ?? {}).sort();
  const uniKeys = Object.keys(GLYPH_TABLES.unicode ?? {}).sort();
  const asciiKeys = Object.keys(GLYPH_TABLES.ascii ?? {}).sort();
  assert.deepEqual(nerdKeys, uniKeys);
  assert.deepEqual(nerdKeys, asciiKeys);
});

test("default unicode keeps the zero-change contract — decorative segments empty (v0.4.8)", () => {
  // The default style must render byte-identically to pre-glyph output: only the
  // identity-row marks (branch/dirty/ahead/behind) carry unicode glyphs; everything
  // decorative stays empty so rows skip the prefix entirely.
  for (const seg of ["model", "clock", "coding", "deen", "burn_rate", "sparkline", "context_gauge", "quota_bar"]) {
    assert.equal(getGlyph(seg, "unicode"), '', `unicode ${seg} must be empty`);
  }
  assert.equal(getGlyph("git_branch", "unicode"), "\u2387");
});
