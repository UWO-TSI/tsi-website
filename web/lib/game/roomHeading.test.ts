import { describe, expect, it } from "vitest";
import { roomHeading, type HeadingPlace } from "./roomHeading";

const village: HeadingPlace = { site: "village", inside: null, atHome: false, event: null };

describe("the place heading (audit-2026-10-ui item 5)", () => {
  it("names each place as before", () => {
    expect(roomHeading(village).title).toBe("Tethos Island");
    expect(roomHeading({ ...village, site: "ruins" }).title).toBe("The ruins");
    expect(roomHeading({ ...village, inside: "oracle" }).title).toBe("Oracle temple");
    expect(roomHeading({ ...village, inside: "hq" }).title).toBe("HQ");
    expect(roomHeading({ ...village, site: "home", atHome: true, inside: "house" }).title).toBe("Your house");
    expect(roomHeading({ ...village, site: "home", atHome: true }).title).toBe("Your island");
  });
  it("gives every room its own line, not the village's", () => {
    const rooms = [
      { ...village, site: "ruins" as const },
      ...(["hq", "oracle", "museum", "shop", "cafe"] as const).map(inside => ({ ...village, inside })),
      { ...village, site: "home" as const, atHome: true, inside: "house" as const },
    ];
    const lines = rooms.map(p => roomHeading(p).subtitle);
    const islandLine = roomHeading(village).subtitle;
    for (const line of lines) expect(line).not.toBe(islandLine);
    expect(new Set(lines).size).toBe(lines.length);
  });
  it("keeps the café's line and the village's event line", () => {
    expect(roomHeading({ ...village, inside: "cafe" }).subtitle).toBe("Warm drinks and quiet tables. Find a seat to study.");
    expect(roomHeading({ ...village, event: "The lantern walk" }).subtitle).toBe("The lantern walk is on.");
    // The event line is the village's: not inside a room, not on your island.
    expect(roomHeading({ ...village, inside: "hq", event: "The lantern walk" }).subtitle).not.toMatch(/is on/);
  });
});
