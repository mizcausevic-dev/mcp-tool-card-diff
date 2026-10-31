# mcp-tool-card-diff

Diff two [MCP Tool Card](https://github.com/mizcausevic-dev/mcp-tool-card-spec) documents and classify the safety transitions that hurt a procurement review. The MCP tool-card counterpart to [`agent-card-diff`](https://github.com/mizcausevic-dev/agent-card-diff).

> Status: v0.1.0 — Node 20/22 supported, library + CLI.

## Why

A Tool Card declares what one MCP tool does and how safely it does it: side-effect class, reversibility, rate-limit, PII / secrets exposure, human-approval requirement, external systems touched, tested-LLM matrix, audit posture. When the card changes between two versions, **which changes invalidate the trust your procurement review already approved?**

## What counts as breaking

| Change | Breaking? |
|---|---|
| `side_effect_class` escalated (read → mutating → external → destructive) | ✅ |
| `reversible` flipped to false | ✅ |
| `rate_limited` removed | ✅ |
| `pii_exposure` escalated (none → low → medium → high) | ✅ |
| `secrets_exposure` escalated (none → reads → writes → handles_keys) | ✅ |
| `human_approval_required` removed | ✅ |
| External system added | ✅ |
| Refusal mode removed | ✅ |
| Input schema changed | ✅ |
| Tested-with model/eval entry removed or legacy test newly failing | ✅ |
| Published pass rate, test timestamp, or sample size changed | Reported; strict mode can gate |
| Audit log URI or legacy location removed | ✅ |
| Audit retention reduced | ✅ |
| Description / version / output-schema / pure additions | — |

## CLI

```
npx mcp-tool-card-diff <previous.json> <next.json>
    [--format json|markdown|summary]
    [--strict] [--out FILE]
```

Exit code:
- `0` — no changes, or only non-breaking changes
- `1` — diff is breaking (or `--strict` and any change exists)
- `2` — usage / I/O error

Drop it into a CI workflow to gate Tool Card PRs: a breaking transition fails the job.

For the [v0.1 Tool Card schema](https://github.com/mizcausevic-dev/mcp-tool-card-spec/blob/main/tool-card.schema.json), a tested-with entry is grouped by optional provider, LLM ID, and test-suite URI. Multiple runs for one group are compared as a multiset, so removing one run is reported even when other runs remain. A changed test-suite URI is treated as removal plus addition. Equal-count changes to pass rate, test timestamp, or sample size are reported but not classified breaking because the spec defines no run ID or diff threshold. When the run count changes, unmatched old runs are treated as removals rather than paired with new runs. The older `provider/model/passed` entry shape remains supported for existing callers. This diff is not a full schema validator; validate each card separately.

## Library

```ts
import { diffToolCards, toMarkdown, toSummary } from "mcp-tool-card-diff";

const diff = diffToolCards(previous, next);
console.log(diff.breaking);        // boolean
console.log(diff.changes);         // [{ reason, detail? }, …]
console.log(diff.added.externalSystems);
console.log(toMarkdown(diff));
console.log(toSummary(diff));      // "BREAKING 11 changes" / "no changes"
```

## Composes with

- [**`mcp-tool-card-spec`**](https://github.com/mizcausevic-dev/mcp-tool-card-spec) — the schema this diffs against.
- [**`mcp-tool-card-generator`**](https://github.com/mizcausevic-dev/mcp-tool-card-generator) — produces the cards.
- [**`mcp-tool-card-summary`**](https://github.com/mizcausevic-dev/mcp-tool-card-summary) — fleet-level analysis across a directory of cards.
- [**`agent-card-diff`**](https://github.com/mizcausevic-dev/agent-card-diff) — sibling: same shape, for A2A AgentCards instead of MCP Tool Cards.

## Develop

```
npm install
npm run lint && npm run typecheck && npm run coverage && npm run build
npm run demo
```

## License

[AGPL-3.0-or-later](LICENSE)
