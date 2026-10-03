import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PROPOSED_RESIDENTS } from "@/lib/content/residentRoster";
import { isFlavour, residentsHome } from "./thinning";

/** The plan's cast: 7 service posts and 5 flavour villagers (12). */
const cast = [
  ...["hq_lead", "shopkeeper", "cafe_owner", "museum_curator", "wharf_keeper", "oracle_keeper", "workshop_crafter"].map(post => ({ slug: post, post })),
  ...["mayor", "juniper", "marlo", "nell", "fern"].map(slug => ({ slug, post: "villager" })),
];
const shown = (others: number) => cast.length - residentsHome(cast, others).size;

describe("villagers go home as the village fills (spec §5.8)", () => {
  it("keeps all 12 up to 5 others, then 10 at 6, 8 at 10, and only the service posts (7) at 15 and over", () => {
    expect([0, 1, 5, 6, 9, 10, 14, 15, 30].map(shown)).toEqual([12, 12, 12, 10, 10, 8, 8, 7, 7]);
  });

  it("never sends a service resident home, and comes back as players leave", () => {
    for (const n of [6, 10, 15, 40]) for (const slug of residentsHome(cast, n)) expect(isFlavour(cast.find(c => c.slug === slug)!)).toBe(true);
    expect(residentsHome(cast, 3).size).toBe(0);
  });

  it("sends the same ones home on every client, and keeps those home as more arrive", () => {
    const six = residentsHome(cast, 6), ten = residentsHome([...cast].reverse(), 10);
    expect(residentsHome([...cast].reverse(), 6)).toEqual(six);
    for (const slug of six) expect(ten.has(slug)).toBe(true);
  });

  it("works on the shipped proposal too (four flavour villagers; the dev roster)", () => {
    const flavour = PROPOSED_RESIDENTS.filter(isFlavour).length;
    expect(residentsHome(PROPOSED_RESIDENTS, 15).size).toBe(flavour);
    expect(residentsHome(PROPOSED_RESIDENTS, 6).size).toBe(Math.min(2, flavour));
  });

  it("is read by the residents from the room's headcount, and they walk home through their door rather than pop", () => {
    const src = readFileSync(new URL("../NPC.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/const others = useOthersIn\("village"\);/);
    expect(src).toMatch(/residentsHome\(personas, others\)/);
    // Home is a walk to their own door (the routine's home stop), and in; a talk or the ceremony keeps them out.
    expect(src).toMatch(/const homeward = home\.has\(r\.slug\) && !talking && !ceremony && !\(r\.hidden && pose\.inside\);/);
    expect(src).toMatch(/const door = homeward \? r\.home :/);
    expect(src).toMatch(/if \(homeward\) r\.hidden = true;/);
  });
});
