#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { diffToolCards } from "./diff.js";
import { toMarkdown, toSummary } from "./format.js";
import type { ToolCard } from "./types.js";

type Format = "json" | "markdown" | "summary";

interface Args {
  previous?: string;
  next?: string;
  format: Format;
  strict: boolean;
  out?: string;
  help: boolean;
}

const FORMATS: Format[] = ["json", "markdown", "summary"];

function parseArgs(argv: string[]): Args {
  const args: Args = { format: "json", strict: false, help: false };
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") args.help = true;
    else if (a === "--format") {
      const v = argv[++i] as Format;
      if (!FORMATS.includes(v)) throw new Error(`--format must be one of: ${FORMATS.join(", ")}`);
      args.format = v;
    } else if (a === "--strict") args.strict = true;
    else if (a === "--out") args.out = argv[++i];
    else if (!a.startsWith("-")) positional.push(a);
    else throw new Error(`Unknown option: ${a}`);
  }
  if (positional[0]) args.previous = positional[0];
  if (positional[1]) args.next = positional[1];
  return args;
}

const HELP = `mcp-tool-card-diff — diff two MCP Tool Card documents

Usage:
  mcp-tool-card-diff <previous.json> <next.json>
      [--format json|markdown|summary]
      [--strict] [--out FILE]

Output:
  json     — full ToolCardDiff with changes[], breaking flag, added/removed maps
  markdown — GitHub-flavored summary table
  summary  — one-line "[BREAKING] N changes"

Exit code:
  0 — no changes OR only non-breaking changes
  1 — diff is breaking (or --strict and any change exists)
  2 — usage / I/O error`;

export function run(argv: string[]): number {
  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n`);
    return 2;
  }
  if (args.help || !args.previous || !args.next) {
    process.stdout.write(`${HELP}\n`);
    return args.help ? 0 : 2;
  }

  let prev: ToolCard;
  let next: ToolCard;
  try {
    prev = JSON.parse(readFileSync(args.previous, "utf8")) as ToolCard;
    next = JSON.parse(readFileSync(args.next, "utf8")) as ToolCard;
  } catch (e) {
    process.stderr.write(`error reading input: ${(e as Error).message}\n`);
    return 2;
  }

  let diff;
  try {
    diff = diffToolCards(prev, next, { strict: args.strict });
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n`);
    return 2;
  }

  let out: string;
  if (args.format === "json") out = JSON.stringify(diff, null, 2);
  else if (args.format === "markdown") out = toMarkdown(diff);
  else out = toSummary(diff);

  if (args.out) writeFileSync(args.out, `${out}\n`, "utf8");
  else process.stdout.write(`${out}\n`);

  if (diff.breaking) return 1;
  if (args.strict && diff.changes.length > 0) return 1;
  return 0;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  try {
    process.exit(run(process.argv.slice(2)));
  } catch (e) {
    process.stderr.write(`fatal: ${(e as Error).message}\n`);
    process.exit(2);
  }
}
