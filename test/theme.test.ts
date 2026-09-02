// test/theme.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { THEME_PRESETS, applyThemeColor } from "../src/theme.ts";

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
