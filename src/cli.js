#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import Table from "cli-table3";
import { parseStack } from "./parser.js";

const program = new Command();
program.name("stacked-tui").description("Visualize stacked PRs").version("0.1.0");

program.command("show")
  .option("--json", "json", false)
  .action((opts) => {
    const stack = parseStack();
    if (opts.json) { console.log(JSON.stringify(stack, null, 2)); return; }
    console.log(chalk.bold.cyan("\nStacked PRs (git log --graph)"));
    const t = new Table({ head: [chalk.cyan("#"), chalk.cyan("Graph"), chalk.cyan("Commit")], colWidths: [4, 12, 60], style: { head: [], border: [] } });
    stack.forEach((s, i) => t.push([String(i), s.graph, s.isStack ? chalk.green(s.msg) : s.msg]));
    console.log(t.toString());
  });

if (process.argv.length === 2) program.parse(["node","cli.js","show"]);
else program.parse();
