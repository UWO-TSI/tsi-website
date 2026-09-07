import { describe, expect, it } from "vitest";
import { sameInteractionTarget } from "./interactionTarget";

describe("interaction target updates", () => {
  it("does not republish the same target as the player keeps moving", () => {
    let target: { id: string; kind: string; spot: number[] } | null = null;
    let updates = 0;
    for (let frame = 0; frame < 144; frame++) {
      const next = { id: "river", kind: "fishing", spot: [2, 5] };
      if (!sameInteractionTarget(target, next)) { target = next; updates++; }
    }
    expect(updates).toBe(1);
  });
  it("publishes entry, exit, target switches and action changes", () => {
    const target = { id: "hq", href: "/hq" };
    expect(sameInteractionTarget(null, target)).toBe(false);
    expect(sameInteractionTarget(target, null)).toBe(false);
    expect(sameInteractionTarget(target, { id: "shop", href: "/shop" })).toBe(false);
    expect(sameInteractionTarget(target, { id: "hq", href: "/jobs" })).toBe(false);
    expect(sameInteractionTarget(null, null)).toBe(true);
  });
  it("preserves live content changes and changed interaction coordinates", () => {
    const npc = { display_name: "Mayor" };
    expect(sameInteractionTarget({ id: "npc", npc }, { id: "npc", npc })).toBe(true);
    expect(sameInteractionTarget({ id: "npc", npc }, { id: "npc", npc: { display_name: "New name" } })).toBe(false);
    expect(sameInteractionTarget({ id: "seat", seat: [1, 2] }, { id: "seat", seat: [1, 3] })).toBe(false);
  });
});
