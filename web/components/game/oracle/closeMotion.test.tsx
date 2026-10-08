import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { memoryCombatStore } from "@/lib/combat/memoryStore";
import { getProgression } from "@/lib/combat/service";
import type { ProgressionView } from "@/lib/game/combat/progression";
import PathSheet from "./PathSheet";
import { FamilyReveal } from "./OracleSheetEmbed";

const M = "00000000-0000-4000-8000-000000000009";
async function view(): Promise<ProgressionView> {
  const c = memoryCombatStore(() => new Date("2026-10-08T12:00:00Z"));
  c.setFamily(M, "Warden");
  const p = await getProgression(c.store, M);
  if (!p.ok) throw new Error("no progression");
  return p.data as ProgressionView;
}

/**
 * audit-2026-10-ui item 4: these stay mounted and are told `open`, so their frame can play its close motion
 * (usePresence) instead of the parent unmounting them mid-frame.
 */
describe("overlays that close with their motion", () => {
  it("Your path follows `open` (the sheet's frame closes it), not its parent's mount", async () => {
    const v = await view();
    const sheet = (open: boolean) => renderToStaticMarkup(createElement(PathSheet, { open, view: v, onClose: () => {}, onChanged: () => {} }));
    expect(sheet(true)).toContain('data-testid="path-sheet"');
    expect(sheet(false)).toBe("");
  });
  it("the Oracle's reveal card follows `open`", () => {
    const card = (open: boolean) => renderToStaticMarkup(createElement(FamilyReveal, { open, family: "Warden", type: "INFJ", onContinue: () => {} }));
    expect(card(true)).toContain('data-testid="oracle-reveal"');
    expect(card(true)).toContain('data-state="open"');
    expect(card(false)).toBe("");
  });
  it("the embedded reveal (the portal's Oracle page) is unchanged: always shown, no motion state", () => {
    const out = renderToStaticMarkup(createElement(FamilyReveal, { family: "Warden", type: "INFJ", embedded: true }));
    expect(out).toContain('data-testid="oracle-reveal"');
    expect(out).not.toContain("data-state");
  });
});
