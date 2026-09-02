// src/versions.ts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

let cachedSelf: string | null = null;

// Our own version: package.json ships alongside src/ (checkout AND npm layout).
export function selfVersion(): string {
  if (cachedSelf !== null) return cachedSelf;
  try {
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
    const parsed = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: unknown };
    cachedSelf = typeof parsed.version === "string" ? parsed.version : "?";
  } catch {
    cachedSelf = "?";
  }
  return cachedSelf;
}

// Host version: no pi extension accessor exists (verified 2026-09-02, pi 0.84.4) —
// spec §15 fallback: read the resolvable pi package.json (the copy we link against).
// Any failure → null → PI fragment omitted (self-only stamp).
export function piVersion(): string | null {
  try {
    const require = createRequire(import.meta.url);
    const pkgPath = require.resolve("@earendil-works/pi-coding-agent/package.json");
    const parsed = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: unknown };
    return typeof parsed.version === "string" ? parsed.version : null;
  } catch {
    return null;
  }
}
