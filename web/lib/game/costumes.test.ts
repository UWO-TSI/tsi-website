import { describe, expect, it } from "vitest";
import { DEFAULT_LOOK, PARTS, eventPartOpen, openEventParts, setEventsOpen, wear, wornParts } from "./character/look";
import { OWNERSHIP_ITEMS } from "@/lib/wallet/catalogue";
import { DEFAULT_TRADITIONS, costumeEvents } from "@/lib/content/traditions";
import { traditionsAt } from "./useTraditions";

const COSTUMES = PARTS.filter((p) => p.event === "halloween");

describe("the costume closet (traditions calendar: Halloween costumes)", () => {
  it("has two Halloween costumes in the wardrobe's accessories, none of them sold (the pumpkin head and vampire cape were cut)", () => {
    expect(COSTUMES.map((p) => p.id).sort()).toEqual(["acc_cat_ears", "acc_witch_hat"]);
    for (const p of COSTUMES) expect(p.slot).toBe("accessory");
    expect(OWNERSHIP_ITEMS.some((e) => COSTUMES.some((p) => e.catalogue_ref === p.id))).toBe(false);
  });

  it("is open, free and drawn only while Halloween runs (Toronto days), and the costume comes off after", () => {
    const during = costumeEvents(DEFAULT_TRADITIONS, Date.parse("2026-10-31T16:00:00Z")), after = costumeEvents(DEFAULT_TRADITIONS, Date.parse("2026-11-03T16:00:00Z"));
    expect(openEventParts(during).sort()).toEqual(COSTUMES.map((p) => p.id).sort());
    expect(openEventParts(after)).toEqual([]);
    expect(eventPartOpen("acc_witch_hat", during)).toBe(true);
    expect(eventPartOpen("acc_witch_hat", after)).toBe(false);
    expect(eventPartOpen("acc_cap", after)).toBe(true); // everything else, always
    const look = wear(DEFAULT_LOOK, "accessory", "acc_witch_hat");
    try {
      setEventsOpen(during);
      expect(wornParts(look).some((p) => p.id === "acc_witch_hat")).toBe(true);
      setEventsOpen(after);
      expect(wornParts(look).some((p) => p.id === "acc_witch_hat")).toBe(false);
      // The hat hid the back hair while worn; off, the hair is back.
      expect(wornParts(look).some((p) => p.slot === "back")).toBe(true);
    } finally {
      setEventsOpen(new Set());
    }
  });

  it("the dev preview ?tradition= dresses the island whatever the date", () => {
    const oct13 = Date.parse("2026-10-13T16:00:00Z");
    expect(traditionsAt(DEFAULT_TRADITIONS, oct13, null).content.pumpkins).toBe(false);
    expect(traditionsAt(DEFAULT_TRADITIONS, oct13, "halloween").content).toEqual({ pumpkins: true, costumes: true, trick_or_treat: true, fog_nights: true });
    expect([...traditionsAt(DEFAULT_TRADITIONS, oct13, "halloween").costumes]).toEqual(["halloween"]);
    expect(traditionsAt(DEFAULT_TRADITIONS, Date.parse("2026-10-31T16:00:00Z"), "none").running).toEqual([]);
  });
});
