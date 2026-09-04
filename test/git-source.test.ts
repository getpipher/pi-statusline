// test/git-source.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGitSource } from "../src/git/source.ts";

// Fixture TZ pin: the brief's fixture keys hardcode +0800 local midnight
// ("...--since 2026-09-02 00:00:00 +0800 HEAD"); formatLocalMidnight derives
// the offset from the host TZ, so pin the fixture frame to match (host is +0700).
process.env.TZ = "Asia/Singapore";

const NOW = Date.UTC(2026, 8, 2, 2, 0); // 2026-09-02 09:00 SGT (UTC+8)
const SGT_OFFSET_MIN = 480;

function fakeRun(responses: Record<string, string | Error>) {
  return (cwd: string, args: string[]): Promise<string> => {
    const key = args.join(" ");
    const r = responses[key];
    if (r instanceof Error) return Promise.reject(r);
    return Promise.resolve(r ?? "");
  };
}

test("clean repo: dirty=false, ahead/behind parsed from rev-list, commitsToday counted", async () => {
  const run = fakeRun({
    "status --porcelain": "",
    "rev-list --left-right --count HEAD...@{upstream}": "2\t3",
    "rev-list --count --since 2026-09-02 00:00:00 +0800 HEAD": "4",
  });
  const src = createGitSource({ now: () => NOW, ttlMs: 30_000, run });
  src.refresh(true);
  await new Promise((r) => setTimeout(r, 0)); // let the async refresh settle
  assert.deepEqual(src.get(), { dirty: false, ahead: 2, behind: 3, commitsToday: 4 });
});

test("dirty worktree + no upstream: dirty=true, ahead/behind null (fragment omitted later)", async () => {
  const run = fakeRun({
    "status --porcelain": " M src/index.ts\n?? new.txt\n",
    "rev-list --left-right --count HEAD...@{upstream}": new Error("no upstream configured"),
    "rev-list --count --since 2026-09-02 00:00:00 +0800 HEAD": "0",
  });
  const src = createGitSource({ now: () => NOW, ttlMs: 30_000, run });
  src.refresh(true);
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(src.get(), { dirty: true, ahead: null, behind: null, commitsToday: 0 });
});

// P3-6 pin: malformed rev-list count output → NaN → commitsToday null (fragment omitted, no crash)
test("malformed rev-list count output → commitsToday null (fragment omitted)", async () => {
  const run = fakeRun({
    "status --porcelain": "",
    "rev-list --left-right --count HEAD...@{upstream}": "2\t3",
    "rev-list --count --since 2026-09-02 00:00:00 +0800 HEAD": "garbage not a number",
  });
  const src = createGitSource({ now: () => NOW, ttlMs: 30_000, run });
  src.refresh(true);
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(src.get(), { dirty: false, ahead: 2, behind: 3, commitsToday: null });
});

test("not a git repo: get() returns null; nothing throws", async () => {
  const run = (_cwd: string, _args: string[]): Promise<string> =>
    Promise.reject(new Error("fatal: not a git repository"));
  const src = createGitSource({ now: () => NOW, ttlMs: 30_000, run });
  src.refresh(true);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(src.get(), null);
});

test("TTL: refresh() inside the window is a no-op; force bypasses; onUpdate fires per successful refresh", async () => {
  let clock = NOW;
  const run = fakeRun({ "status --porcelain": "" });
  let updates = 0;
  const src = createGitSource({ now: () => clock, ttlMs: 30_000, run, onUpdate: () => { updates++; } });
  src.refresh(true);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(updates, 1);
  src.refresh(); // inside TTL → no exec, no update
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(updates, 1);
  clock = NOW + 31_000;
  src.refresh(); // TTL expired → refreshes
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(updates, 2);
});
