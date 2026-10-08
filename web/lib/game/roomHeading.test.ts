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
  it("shows only the name in rooms (David, 2026-10-08)", () => {
    const rooms = [
      { ...village, site: "ruins" as const },
      ...(["hq", "oracle", "museum", "shop"] as const).map(inside => ({ ...village, inside })),
      { ...village, site: "home" as const, atHome: true, inside: "house" as const },
    ];
    for (const p of rooms) expect(roomHeading(p).subtitle).toBe("");
  });
  it("keeps the café's line and the village's event line", () => {
    expect(roomHeading({ ...village, inside: "cafe" }).subtitle).toBe("Warm drinks and quiet tables. Find a seat to study.");
    expect(roomHeading({ ...village, event: "The lantern walk" }).subtitle).toBe("The lantern walk is on.");
    // The event line is the village's: not inside a room, not on your island.
    expect(roomHeading({ ...village, inside: "hq", event: "The lantern walk" }).subtitle).not.toMatch(/is on/);
  });
});
