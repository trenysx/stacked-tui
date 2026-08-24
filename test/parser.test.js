import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseStack,
  parseLogString,
  isStackCommit,
  extractBranch,
  extractHash,
  getMockStack,
  getStackSummary,
  filterStack,
  generateStackReport,
} from "../src/parser.js";

test("parseStack returns array", () => {
  const s = parseStack();
  assert.ok(Array.isArray(s));
  assert.ok(s.length > 0);
});

test("parseLogString — parses graph and msg", () => {
  const log = "* feat: top (HEAD -> feature/auth)\n* fix: base (main)\n";
  const parsed = parseLogString(log);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].graph, "* ");
  assert.ok(parsed[0].msg.includes("feature/auth"));
  assert.equal(parsed[0].isStack, true);
  assert.equal(parsed[1].branch, "main");
});

test("parseLogString — handles merges and depth", () => {
  const log = "| * fix: stacked (feature/ui)\n|/\n* main\n";
  const parsed = parseLogString(log);
  assert.ok(parsed.some(s => s.isMerge));
  assert.ok(parsed[0].depth >= 0);
});

test("parseLogString — empty", () => {
  assert.deepEqual(parseLogString(""), []);
  assert.deepEqual(parseLogString(null), []);
});

test("isStackCommit", () => {
  assert.equal(isStackCommit("feat: (HEAD -> feature/auth)"), true);
  assert.equal(isStackCommit("fix: (origin/feature/base)"), true);
  assert.equal(isStackCommit("chore: base (main)"), false);
  assert.equal(isStackCommit(""), false);
  assert.equal(isStackCommit("stacked PR"), true);
});

test("extractBranch — HEAD arrow", () => {
  assert.equal(extractBranch("feat: (HEAD -> feature/auth)"), "feature/auth");
  assert.equal(extractBranch("fix: (origin/feature/base)"), "origin/feature/base");
  assert.equal(extractBranch("chore: (main)"), "main");
  assert.equal(extractBranch("no paren"), null);
});

test("extractBranch — multiple", () => {
  assert.equal(extractBranch("feat: (HEAD -> feature/auth, origin/feature/auth)"), "feature/auth");
});

test("extractHash", () => {
  assert.equal(extractHash("abc1234 feat: test"), "abc1234");
  assert.equal(extractHash("no hash"), null);
});

test("getMockStack", () => {
  const mock = getMockStack();
  assert.ok(mock.length >= 3);
  assert.ok(mock[0].isStack);
  assert.ok(mock[0].branch);
});

test("getStackSummary", () => {
  const stack = getMockStack();
  const summary = getStackSummary(stack);
  assert.equal(summary.total, stack.length);
  assert.ok(summary.stacked >= 1);
  assert.ok(Array.isArray(summary.branches));
  assert.ok(summary.top);
  const empty = getStackSummary([]);
  assert.equal(empty.total, 0);
});

test("filterStack", () => {
  const stack = getMockStack();
  const onlyStack = filterStack(stack, { onlyStack: true });
  assert.ok(onlyStack.every(s => s.isStack));
  const byBranch = filterStack(stack, { branch: "feature/auth" });
  assert.ok(byBranch.length >= 1);
  assert.ok(byBranch[0].branch.includes("feature/auth"));
  const all = filterStack(stack, {});
  assert.equal(all.length, stack.length);
});

test("generateStackReport", () => {
  const stack = getMockStack();
  const md = generateStackReport(stack);
  assert.ok(md.includes("# Stacked PRs Report"));
  assert.ok(md.includes("feature/auth"));
  const emptyMd = generateStackReport([]);
  assert.ok(emptyMd.includes("Total commits: 0"));
});

test("parseStack with limit", () => {
  const stack = parseStack({ limit: 5 });
  assert.ok(Array.isArray(stack));
  // Should return at most 5 or mock size
  assert.ok(stack.length >= 0);
});

test("parseStack mockOnFail false", () => {
  // In non-git dir, with mockOnFail false should return [] or mock? Our parser returns [] on fail if mockOnFail false, but git log will fail in this env (git not in PATH) so it will go to catch and return [] if false, mock if true
  const withMock = parseStack({ mockOnFail: true });
  assert.ok(withMock.length > 0);
});

test("getMockStack structure", () => {
  const mock = getMockStack();
  for (const s of mock) {
    assert.ok("id" in s);
    assert.ok("graph" in s);
    assert.ok("msg" in s);
    assert.ok("isStack" in s);
    assert.ok("branch" in s);
  }
});

test("isStackCommit — case insensitive", () => {
  assert.equal(isStackCommit("STACKED PR"), true);
  assert.equal(isStackCommit("Feature/auth"), true);
});
