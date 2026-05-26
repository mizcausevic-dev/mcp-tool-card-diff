import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { diffToolCards } from "../src/diff.js";
import { toMarkdown, toSummary } from "../src/format.js";
import { BREAKING_REASONS, type ToolCard } from "../src/types.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const fixture = (name: string): ToolCard =>
  JSON.parse(readFileSync(`${here}/../fixtures/${name}`, "utf8")) as ToolCard;

describe("diffToolCards", () => {
  it("returns no changes when cards are equivalent", () => {
    const v1 = fixture("card-v1.json");
    const r = diffToolCards(v1, JSON.parse(JSON.stringify(v1)));
    expect(r.changes).toEqual([]);
    expect(r.breaking).toBe(false);
  });

  it("flags v1 → v2-breaking as BREAKING with the expected reasons", () => {
    const r = diffToolCards(fixture("card-v1.json"), fixture("card-v2-breaking.json"));
    expect(r.breaking).toBe(true);
    const reasons = r.changes.map((c) => c.reason);
    expect(reasons).toContain("rate-limit-removed");
    expect(reasons).toContain("pii-exposure-escalated");
    expect(reasons).toContain("secrets-exposure-escalated");
    expect(reasons).toContain("human-approval-removed");
    expect(reasons).toContain("external-system-added");
    expect(reasons).toContain("refusal-mode-removed");
    expect(reasons).toContain("input-schema-changed");
    expect(reasons).toContain("tested-with-newly-failing");
    expect(reasons).toContain("audit-log-location-removed");
    expect(reasons).toContain("audit-retention-reduced");
    expect(reasons).toContain("tool-version-changed");
  });

  it("v1 → v2-nonbreaking has no breaking reasons", () => {
    const r = diffToolCards(fixture("card-v1.json"), fixture("card-v2-nonbreaking.json"));
    expect(r.breaking).toBe(false);
    const reasons = r.changes.map((c) => c.reason);
    expect(reasons).toContain("tool-version-changed");
    expect(reasons).toContain("tool-description-changed");
    expect(reasons).toContain("refusal-mode-added");
    // tested-provider-added shows up in `added.testedProviders`, not as a change row
    expect(r.added.testedProviders).toEqual(["anthropic/claude-opus-4-7"]);
    expect(reasons).not.toContain("rate-limit-removed");
    expect(reasons).not.toContain("human-approval-removed");
  });

  it("flags side-effect-class escalation as breaking", () => {
    const v1 = fixture("card-v1.json");
    const v2 = JSON.parse(JSON.stringify(v1)) as ToolCard;
    v1.safety.side_effect_class = "read";
    v2.safety.side_effect_class = "destructive";
    const r = diffToolCards(v1, v2);
    expect(r.changes.some((c) => c.reason === "side-effect-class-escalated")).toBe(true);
    expect(r.breaking).toBe(true);
  });

  it("flags side-effect-class relaxation as non-breaking", () => {
    const v1 = fixture("card-v1.json");
    const v2 = JSON.parse(JSON.stringify(v1)) as ToolCard;
    v2.safety.side_effect_class = "mutating";
    const r = diffToolCards(v1, v2);
    expect(r.changes.some((c) => c.reason === "side-effect-class-relaxed")).toBe(true);
    expect(r.changes.some((c) => c.reason === "side-effect-class-escalated")).toBe(false);
  });

  it("populates added / removed maps for external systems and refusal modes", () => {
    const r = diffToolCards(fixture("card-v1.json"), fixture("card-v2-breaking.json"));
    expect(r.added.externalSystems).toEqual(["s3.amazonaws.com"]);
    expect(r.removed.refusalModes).toEqual(["legal-hold"]);
  });

  it("flags output-schema-changed independently of input-schema-changed", () => {
    const v1 = fixture("card-v1.json");
    const v2 = JSON.parse(JSON.stringify(v1)) as ToolCard;
    v2.schema.output_schema_inline = { type: "object", properties: { ok: { type: "boolean" } } };
    const r = diffToolCards(v1, v2);
    expect(r.changes.some((c) => c.reason === "output-schema-changed")).toBe(true);
  });

  it("throws on malformed inputs", () => {
    expect(() => diffToolCards(null as unknown as ToolCard, fixture("card-v1.json"))).toThrow();
    expect(() => diffToolCards({ tool: { name: "x" } } as ToolCard, fixture("card-v1.json"))).toThrow();
  });

  it("mcp-server-uri-changed flagged when URI moves", () => {
    const v1 = fixture("card-v1.json");
    const v2 = JSON.parse(JSON.stringify(v1)) as ToolCard;
    v2.tool.mcp_server_uri = "https://other.example.com/mcp";
    const r = diffToolCards(v1, v2);
    expect(r.changes.some((c) => c.reason === "mcp-server-uri-changed")).toBe(true);
  });

  it("tested-with-provider-removed flagged when a provider disappears", () => {
    const v1 = fixture("card-v1.json");
    const v2 = JSON.parse(JSON.stringify(v1)) as ToolCard;
    v2.tested_with = [];
    const r = diffToolCards(v1, v2);
    expect(r.changes.some((c) => c.reason === "tested-with-provider-removed")).toBe(true);
  });
});

describe("formatters", () => {
  it("toMarkdown highlights BREAKING when applicable", () => {
    const md = toMarkdown(diffToolCards(fixture("card-v1.json"), fixture("card-v2-breaking.json")));
    expect(md).toContain("BREAKING");
    expect(md).toContain("Human approval requirement removed");
  });

  it("toMarkdown emits 'No changes.' on equivalent cards", () => {
    const v1 = fixture("card-v1.json");
    expect(toMarkdown(diffToolCards(v1, JSON.parse(JSON.stringify(v1))))).toContain("No changes");
  });

  it("toSummary returns 'no changes' / 'BREAKING N changes'", () => {
    const v1 = fixture("card-v1.json");
    expect(toSummary(diffToolCards(v1, JSON.parse(JSON.stringify(v1))))).toBe("no changes");
    expect(toSummary(diffToolCards(fixture("card-v1.json"), fixture("card-v2-breaking.json")))).toMatch(/^BREAKING \d+ changes$/);
  });
});

describe("BREAKING_REASONS catalogue", () => {
  it("includes the high-risk transitions", () => {
    expect(BREAKING_REASONS.has("side-effect-class-escalated")).toBe(true);
    expect(BREAKING_REASONS.has("human-approval-removed")).toBe(true);
    expect(BREAKING_REASONS.has("pii-exposure-escalated")).toBe(true);
  });
  it("does NOT mark pure relaxations as breaking", () => {
    expect(BREAKING_REASONS.has("side-effect-class-relaxed")).toBe(false);
    expect(BREAKING_REASONS.has("human-approval-added")).toBe(false);
  });
});
