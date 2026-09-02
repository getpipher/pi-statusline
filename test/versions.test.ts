// test/versions.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { selfVersion, piVersion } from "../src/versions.ts";

test("selfVersion reads our package.json version (semver-ish)", () => {
  assert.match(selfVersion(), /^\d+\.\d+\.\d+/);
});

test("piVersion resolves the linked pi package or null — never throws", () => {
  const v = piVersion();
  if (v !== null) assert.match(v, /^\d+\.\d+\.\d+/);
});
