/**
 * parser.js — git log graph parser for stacked PRs
 * Parses `git log --oneline --graph --all --decorate` into structured stack.
 */
import { execSync } from "node:child_process";

export function parseStack(opts = {}) {
  const { limit = 20, mockOnFail = true } = opts;
  try {
    const log = execSync(`git log --oneline --graph --all --decorate -n ${limit}`, { encoding: "utf8", timeout: 4000 });
    return parseLogString(log);
  } catch {
    if (!mockOnFail) return [];
    return getMockStack();
  }
}

export function parseLogString(log) {
  if (!log || typeof log !== "string") return [];
  const lines = log.split("\n").filter(l => l.trim() !== "");
  return lines.map((line, idx) => {
    const graphMatch = line.match(/^[\s|*\\/]+/);
    const graph = graphMatch ? graphMatch[0] : "";
    const msg = line.replace(/^[\s|*\\/]+/, "").trim();
    const isStack = isStackCommit(msg);
    const branch = extractBranch(msg);
    const hash = extractHash(msg);
    return {
      id: idx,
      raw: line,
      graph,
      msg,
      branch,
      hash,
      isStack,
      depth: graph.replace(/[^|]/g, "").length,
      isMerge: msg.toLowerCase().includes("merge") || graph.includes("/") || graph.includes("\\"),
    };
  });
}

export function isStackCommit(msg) {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return (
    msg.includes("HEAD") ||
    msg.includes("origin/") ||
    lower.includes("stack") ||
    /feature\//i.test(msg) ||
    /stacked/.test(lower) ||
    /\(.*->/.test(msg)
  );
}

export function extractBranch(msg) {
  // Try to extract branch from decorate: "feat: (HEAD -> feature/auth, origin/main)"
  const parenMatch = msg.match(/\(([^)]+)\)/);
  if (parenMatch) {
    const parts = parenMatch[1].split(",").map(s => s.trim());
    for (const p of parts) {
      if (p.includes("->")) {
        const arrow = p.split("->")[1]?.trim();
        if (arrow) return arrow;
      } else if (p.startsWith("origin/")) return p;
      else if (p === "HEAD") continue;
      else if (!p.includes("HEAD") && p.includes("/")) return p;
    }
    // fallback: first non-HEAD
    const first = parts.find(p => !p.includes("HEAD") && p.trim());
    if (first) return first.trim();
  }
  return null;
}

export function extractHash(msg) {
  // Hash is usually first 7 chars before graph? In log string, after graph, first token may be hash if --oneline
  // For mock, we don't have hash, return null
  const m = msg.match(/^([a-f0-9]{7,40})\s/);
  return m ? m[1] : null;
}

export function getMockStack() {
  return [
    { id: 0, raw: "* feat: top of stack (HEAD -> feature/auth)", graph: "* ", msg: "feat: top of stack (HEAD -> feature/auth)", branch: "feature/auth", hash: "abc123", isStack: true, depth: 1, isMerge: false },
    { id: 1, raw: "* feat: middle (origin/feature/base)", graph: "* ", msg: "feat: middle (origin/feature/base)", branch: "origin/feature/base", hash: "def456", isStack: true, depth: 1, isMerge: false },
    { id: 2, raw: "* chore: base (main)", graph: "* ", msg: "chore: base (main)", branch: "main", hash: "789abc", isStack: false, depth: 1, isMerge: false },
    { id: 3, raw: "| * fix: stacked PR #2 (feature/ui)", graph: "| *", msg: "fix: stacked PR #2 (feature/ui)", branch: "feature/ui", hash: "111222", isStack: true, depth: 2, isMerge: false },
    { id: 4, raw: "|/", graph: "|/", msg: "", branch: null, hash: null, isStack: false, depth: 0, isMerge: true },
  ];
}

export function getStackSummary(stack) {
  const total = stack.length;
  const stacked = stack.filter(s => s.isStack).length;
  const merges = stack.filter(s => s.isMerge).length;
  const branches = [...new Set(stack.map(s => s.branch).filter(Boolean))];
  return { total, stacked, merges, branches, top: stack[0] || null };
}

export function filterStack(stack, { onlyStack = false, branch = null } = {}) {
  let filtered = [...stack];
  if (onlyStack) filtered = filtered.filter(s => s.isStack);
  if (branch) filtered = filtered.filter(s => s.branch && s.branch.includes(branch));
  return filtered;
}

export function generateStackReport(stack) {
  const summary = getStackSummary(stack);
  const lines = [];
  lines.push(`# Stacked PRs Report — ${new Date().toISOString().slice(0, 10)}`);
  lines.push(``);
  lines.push(`- Total commits: ${summary.total}`);
  lines.push(`- Stacked: ${summary.stacked}`);
  lines.push(`- Branches: ${summary.branches.join(", ") || "none"}`);
  lines.push(``);
  lines.push(`| # | Graph | Branch | Message | Stack |`);
  lines.push(`|---|-------|--------|---------|-------|`);
  for (const s of stack) {
    lines.push(`| ${s.id} | \`${s.graph.trim() || "-"}\` | ${s.branch || "-"} | ${s.msg.slice(0, 40)} | ${s.isStack ? "✓" : "-"} |`);
  }
  return lines.join("\n");
}

export function visualizeStackAscii(stack) {
  if (!stack.length) return "(empty stack)";
  const lines = [];
  lines.push("Stacked PRs (ASCII):");
  for (const s of stack) {
    const marker = s.isStack ? chalkOrPlain(s) : s.msg;
    lines.push(`${String(s.id).padStart(2)} ${s.graph.padEnd(6)} ${marker}`);
  }
  return lines.join("\n");
}

function chalkOrPlain(s) {
  // Avoid importing chalk in parser (keep pure), but return plain for now
  return s.msg;
}

export function getCurrentStackBranch() {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8", timeout: 2000 }).trim();
    return branch;
  } catch { return null; }
}
