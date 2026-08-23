import { execSync } from "node:child_process";

export function parseStack() {
  try {
    const log = execSync("git log --oneline --graph --all --decorate -n 20", { encoding: "utf8", timeout: 3000 });
    return log.split("\n").filter(Boolean).map((line, i) => ({
      id: i,
      graph: line.match(/^[\s|*\\/]+/)?.[0] || "",
      msg: line.replace(/^[\s|*\\/]+/, "").trim(),
      isStack: line.includes("HEAD") || line.includes("origin/")
    }));
  } catch {
    return [
      { id: 0, graph: "* ", msg: "feat: top of stack (HEAD -> feature/auth)", isStack: true },
      { id: 1, graph: "* ", msg: "feat: middle (origin/feature/base)", isStack: true },
      { id: 2, graph: "* ", msg: "chore: base (main)", isStack: false }
    ];
  }
}
