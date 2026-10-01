import { describe, expect, it } from "vitest";
import { DEFAULT_NPC_PERSONAS } from "@/data/content-defaults";
import { villageIsland } from "@/lib/game/defaultIsland";
import { RESIDENT_ANCHORS, SHARED_SPACING, anchorAt, residentSpots, validateResidentDraft, type ResidentAnchor } from "./residents";
import { objectsOf } from "@/lib/game/villageMap";
import type { NPCPersona } from "./types";

const persona = (slug: string, schedule: Record<string, string> = {}) => ({ ...DEFAULT_NPC_PERSONAS[0], id: slug, slug, schedule }) as NPCPersona;

describe("residents", () => {
  it("every schedule anchor is open ground, for up to three residents sharing it", () => {
    const island = villageIsland();
    for (const key of Object.keys(RESIDENT_ANCHORS) as ResidentAnchor[]) {
      const [x, z] = anchorAt(key)!;
      for (let k = 0; k < 3; k++) {
        const px = x + k * SHARED_SPACING;
        expect([[0, 0], [-0.2, 0], [0.2, 0], [0, -0.2], [0, 0.2]].every(([dx, dz]) => island.standable(px + dx, z + dz)), `${key} #${k}`).toBe(true);
      }
    }
  });

  it("keeps the seeded two at their anchors, gathering at the map's ceremony spots", () => {
    const spots = residentSpots(DEFAULT_NPC_PERSONAS, "night");
    const at = (key: ResidentAnchor) => [anchorAt(key)![0], 0, anchorAt(key)![1]];
    const [g0, g1] = objectsOf("gather").map((g) => [g.x, 0, g.z]);
    expect(spots.map((s) => [s.persona.slug, s.home, s.plaza])).toEqual([
      ["mayor", at("path"), g0],
      ["shopkeeper", at("shop"), g1],
    ]);
  });

  it("follows the phase, falls back to the day spot, then the plaza, and spaces out shared spots", () => {
    const rows = [persona("a", { day: "shop", night: "hq" }), persona("b", { day: "shop" }), persona("c")];
    const [hq, shop, plaza] = (["hq", "shop", "plaza"] as const).map((k) => anchorAt(k)!);
    expect(residentSpots(rows, "night").map((s) => s.home)).toEqual([[hq[0], 0, hq[1]], [shop[0], 0, shop[1]], [plaza[0], 0, plaza[1]]]);
    expect(residentSpots(rows, "day").map((s) => s.home)).toEqual([[shop[0], 0, shop[1]], [shop[0] + SHARED_SPACING, 0, shop[1]], [plaza[0], 0, plaza[1]]]);
  });

  it("validates resident drafts", () => {
    expect(validateResidentDraft({ slug: "kit", display_name: "Kit", post: "wharf_keeper", tone: "dry", bio: "", canned_dialogue: ["Hi."], schedule: { day: "wharf" } })).toEqual([]);
    expect(validateResidentDraft({ slug: "Kit!", display_name: "", post: "wizard", canned_dialogue: [""], schedule: { noon: "wharf" } })).toHaveLength(5);
    expect(validateResidentDraft({ slug: "kit", display_name: "Kit", schedule: { day: "moon" } })).toEqual(["schedule: phase → stop or routine of stops; home → a building"]);
    expect(validateResidentDraft({ slug: "kit", display_name: "Kit", schedule: { home: "shop", day: ["shop", "pond", "bench"], night: ["bench", "home"] } })).toEqual([]);
    expect(validateResidentDraft({ slug: "kit", display_name: "Kit", schedule: { home: "moon" } })).toHaveLength(1);
    expect(validateResidentDraft({ slug: "kit", display_name: "Kit", schedule: { day: [] } })).toHaveLength(1);
    expect(validateResidentDraft({ slug: "kit", display_name: "Kit", schedule: { day: ["shop", "shop", "shop", "shop", "shop", "shop", "shop"] } })).toHaveLength(1);
  });

  it("caps the persona prompt on the server too", () => {
    expect(validateResidentDraft({ slug: "kit", display_name: "Kit", persona_prompt: "x".repeat(2000) })).toEqual([]);
    expect(validateResidentDraft({ slug: "kit", display_name: "Kit", persona_prompt: null })).toEqual([]);
    expect(validateResidentDraft({ slug: "kit", display_name: "Kit", persona_prompt: "x".repeat(2001) })).toEqual(["persona_prompt: up to 2000 characters"]);
  });
});
