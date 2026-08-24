#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
import { writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { parseStack, parseLogString, getStackSummary, filterStack, generateStackReport, getMockStack } from "./parser.js";

const program = new Command();
program.name("stacked-tui").description("Visualize stacked PRs as interactive graph — git log --graph parser + TUI").version("0.1.0");

program.command("show")
  .description("Show stacked PRs (parsed git log --graph)")
  .option("--json", "json output", false)
  .option("--only-stack", "only show stacked commits", false)
  .option("--branch <name>", "filter by branch", null)
  .option("--limit <n>", "limit commits", "20")
  .option("--report <path>", "write markdown report", null)
  .action(async (opts) => {
    const limit = parseInt(opts.limit, 10) || 20;
    let stack = parseStack({ limit });
    if (opts.onlyStack) stack = filterStack(stack, { onlyStack: true });
    if (opts.branch) stack = filterStack(stack, { branch: opts.branch });
    if (opts.json) { console.log(JSON.stringify({ total: stack.length, stack }, null, 2)); return; }
    const summary = getStackSummary(stack);
    console.log(chalk.bold.cyan(`\n⎈ Stacked PRs — ${stack.length} commits (${summary.stacked} stacked, ${summary.branches.length} branches)`));
    console.log(chalk.dim(`Top: ${summary.top?.branch || "-"} | Current: ${summary.top?.msg.slice(0, 50) || "-"}`));
    if (!stack.length) { console.log(chalk.yellow("No commits — not a git repo? Showing mock:")); stack = getMockStack(); }
    const t = new Table({
      head: [chalk.cyan("#"), chalk.cyan("Graph"), chalk.cyan("Branch"), chalk.cyan("Message"), chalk.cyan("Stack")],
      colWidths: [4, 12, 22, 48, 8],
      wordWrap: true,
      style: { head: [], border: [] }
    });
    for (const s of stack) {
      const branch = s.branch || "-";
      const msg = s.isStack ? chalk.green(s.msg.slice(0, 48)) : s.msg.slice(0, 48);
      t.push([String(s.id), s.graph || "-", branch.slice(0, 22), msg, s.isStack ? "✓" : "-"]);
    }
    console.log(t.toString());
    if (opts.report) {
      const md = generateStackReport(stack);
      await writeFile(opts.report, md, "utf8");
      console.log(chalk.dim(`Report written to ${opts.report}`));
    }
  });

program.command("graph")
  .description("Show raw git graph")
  .option("--limit <n>", "limit", "20")
  .action((opts) => {
    const limit = parseInt(opts.limit, 10) || 20;
    try {
      const log = execSync(`git log --oneline --graph --all --decorate -n ${limit}`, { encoding: "utf8" });
      console.log(log);
    } catch (e) {
      console.log(chalk.yellow("Not a git repo or git not found — mock graph:"));
      console.log(getMockStack().map(s => `${s.graph}${s.msg}`).join("\n"));
    }
  });

program.command("summary")
  .description("Show stack summary")
  .option("--json", "json output", false)
  .action((opts) => {
    const stack = parseStack();
    const summary = getStackSummary(stack);
    if (opts.json) { console.log(JSON.stringify(summary, null, 2)); return; }
    console.log(chalk.bold.cyan("\n⎈ Stack Summary"));
    console.log(`Total: ${summary.total} | Stacked: ${summary.stacked} | Branches: ${summary.branches.join(", ") || "none"}`);
    console.log(`Top: ${summary.top?.msg || "-"}`);
  });

program.command("mock")
  .description("Show mock stacked data")
  .option("--json", "json output", false)
  .action((opts) => {
    const stack = getMockStack();
    if (opts.json) { console.log(JSON.stringify(stack, null, 2)); return; }
    console.log(chalk.bold.cyan("\n⎈ Mock Stack"));
    for (const s of stack) console.log(`${s.graph} ${s.msg} ${s.isStack ? chalk.green("(stack)") : ""}`);
  });

program.command("demo")
  .description("Demo with mock data")
  .action(() => {
    const stack = getMockStack();
    console.log(chalk.bold("Demo stacked PRs:"));
    console.log(generateStackReport(stack).slice(0, 800));
    console.log(chalk.dim("\nTry: stacked-tui show --json | jq"));
  });

if (process.argv.length === 2) program.parse(["node", "cli.js", "show"]);
else program.parse();
