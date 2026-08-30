// test/tui-settings.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { parseStatuslineArgs } from "../src/tui/settings.ts";

test("parseStatuslineArgs: empty args → 'open-panel'", () => {
  assert.deepEqual(parseStatuslineArgs(""), { action: "open-panel" });
  assert.deepEqual(parseStatuslineArgs(undefined), { action: "open-panel" });
});

test("parseStatuslineArgs: 'refresh' → refresh action", () => {
  assert.deepEqual(parseStatuslineArgs("refresh"), { action: "refresh" });
});

test("parseStatuslineArgs: 'on' → enable", () => {
  assert.deepEqual(parseStatuslineArgs("on"), { action: "set-enabled", enabled: true });
});

test("parseStatuslineArgs: 'off' → disable", () => {
  assert.deepEqual(parseStatuslineArgs("off"), { action: "set-enabled", enabled: false });
});

test("parseStatuslineArgs: 'tier auto' → set tier", () => {
  assert.deepEqual(parseStatuslineArgs("tier auto"), { action: "set-tier", tier: "auto" });
  assert.deepEqual(parseStatuslineArgs("tier pro"), { action: "set-tier", tier: "pro" });
  assert.deepEqual(parseStatuslineArgs("tier max"), { action: "set-tier", tier: "max" });
  assert.deepEqual(parseStatuslineArgs("tier lite"), { action: "set-tier", tier: "lite" });
});

test("parseStatuslineArgs: tier tolerates surrounding whitespace and mixed case", () => {
  assert.deepEqual(parseStatuslineArgs("  TiEr   PRO  "), { action: "set-tier", tier: "pro" });
});

test("parseStatuslineArgs: 'tier invalid' → error", () => {
  const result = parseStatuslineArgs("tier bogus");
  assert.equal(result.action, "error");
  assert.ok((result as { message: string }).message.includes("tier must be"), `error message: ${JSON.stringify(result)}`);
});

test("parseStatuslineArgs: unknown command → error", () => {
  const result = parseStatuslineArgs("bogus-command");
  assert.equal(result.action, "error");
});

// ── v2.1: deen subcommand ──

test("deen subcommand parses city or auto; bare deen errors with usage", () => {
  assert.deepEqual(parseStatuslineArgs("deen Mecca"), { action: "set-deen-city", city: "Mecca" });
  assert.deepEqual(parseStatuslineArgs("deen auto"), { action: "set-deen-city", city: "auto" });
  assert.deepEqual(parseStatuslineArgs("deen"), { action: "error", message: "usage: /statusline deen <city|auto>" });
});
