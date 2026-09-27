import { describe, expect, it } from "vitest";
import { DEFAULT_NPC_PERSONAS } from "@/data/content-defaults";
import { createDefaultIsland } from "@/lib/game/defaultIsland";
import { RESIDENT_ANCHORS, SHARED_SPACING, residentSpots, validateResidentDraft } from "./residents";
import type { NPCPersona } from "./types";

const persona = (slug: string, schedule: Record<string, string> = {}) => ({ ...DEFAULT_NPC_PERSONAS[0], id: slug, slug, schedule }) as NPCPersona;

describe("residents", () => {
  it("every schedule anchor is open ground, for up to three residents sharing it", () => {
    const island = createDefaultIsland();
    for (const [key, { at: [x, z] }] of Object.entries(RESIDENT_ANCHORS)) {
      for (let k = 0; k < 3; k++) {
        const px = x + k * SHARED_SPACING;
        expect([[0, 0], [-0.2, 0], [0.2, 0], [0, -0.2], [0, 0.2]].every(([dx, dz]) => island.standable(px + dx, z + dz)), `${key} #${k}`).toBe(true);
      }
    }
  });

  it("keeps the seeded two where they stood before schedules", () => {
    const spots = residentSpots(DEFAULT_NPC_PERSONAS, "night");
    expect(spots.map((s) => [s.persona.slug, s.home, s.plaza])).toEqual([
      ["mayor", [-2, 0, -7], [-3.3, 0, 2.3]],
      ["shopkeeper", [9, 0, -9.6], [-6.6, 0, 1.9]],
    ]);
  });

  it("follows the phase, falls back to the day spot, then the plaza, and spaces out shared spots", () => {
    const rows = [persona("a", { day: "shop", night: "hq" }), persona("b", { day: "shop" }), persona("c")];
    expect(residentSpots(rows, "night").map((s) => s.home)).toEqual([[1.2, 0, 4.2], [9, 0, -9.6], [-3.3, 0, 2.3]]);
    expect(residentSpots(rows, "day").map((s) => s.home)).toEqual([[9, 0, -9.6], [9 + SHARED_SPACING, 0, -9.6], [-3.3, 0, 2.3]]);
  });

  it("validates resident drafts", () => {
    expect(validateResidentDraft({ slug: "kit", display_name: "Kit", post: "wharf_keeper", tone: "dry", bio: "", canned_dialogue: ["Hi."], schedule: { day: "wharf" } })).toEqual([]);
    expect(validateResidentDraft({ slug: "Kit!", display_name: "", post: "wizard", canned_dialogue: [""], schedule: { noon: "wharf" } })).toHaveLength(5);
    expect(validateResidentDraft({ slug: "kit", display_name: "Kit", schedule: { day: "moon" } })).toEqual(["schedule: phase → anchor"]);
  });
});
