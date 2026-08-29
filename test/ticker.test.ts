// test/ticker.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import { createTicker } from "../src/ticker.ts";

test("ticker fires onTick repeatedly and stop() ends it", async () => {
  let ticks = 0;
  const ticker = createTicker({ intervalMs: 5, onTick: () => { ticks += 1; } });
  ticker.start();
  await sleep(40);
  const afterRun = ticks;
  assert.ok(afterRun >= 2, `expected ≥2 ticks, got ${afterRun}`);
  ticker.stop();
  await sleep(20);
  assert.equal(ticks, afterRun); // no ticks after stop
});

test("onTick exceptions do not kill the interval", async () => {
  let ticks = 0;
  const ticker = createTicker({ intervalMs: 5, onTick: () => { ticks += 1; if (ticks === 1) throw new Error("boom"); } });
  ticker.start();
  await sleep(40);
  assert.ok(ticks >= 2);
  ticker.stop();
});
