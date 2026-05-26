# Changelog

## v0.1.0 — 2026-05-27

- Initial release: diff two MCP Tool Card v0.1 documents and classify safety transitions.
- 26 change reasons across tool meta, safety (side-effect class / reversibility / rate-limit / PII / secrets / human-approval / external systems / refusal modes), schema, tested-with, and audit posture.
- Breaking-change flag covers: side-effect-class escalated, reversible flipped false, rate-limit removed, PII / secrets escalation, human-approval removed, external system added, refusal mode removed, input schema changed, tested-with provider removed or newly failing, audit log location removed, audit retention reduced.
- Library API: `diffToolCards(previous, next, opts)`, plus `toMarkdown(diff)` and `toSummary(diff)` formatters.
- CLI: `mcp-tool-card-diff <prev.json> <next.json>` with `--format json|markdown|summary`, `--strict`, `--out FILE`. Exit 1 on breaking change.
- Lane #1 — the MCP tool-card counterpart to `agent-card-diff` (A2A AgentCards).
- Node 20/22 CI (lint, typecheck, coverage, build, demo, `npm audit`), AGPL-3.0-or-later, Dependabot.
