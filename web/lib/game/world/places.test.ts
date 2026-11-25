import { describe, expect, it } from "vitest";
import { placeAt } from "./places";

describe("placeAt (the HUD's place name)", () => {
  it("names the area you stand in, the smaller one where two overlap", () => {
    expect(placeAt(71.74, 26.8)).toBe("Wharf"); // the sell stall
    expect(placeAt(43, 37)).toBe("Village"); // a house lot reads as the village
    expect(placeAt(0, 0)).toBe("Meadow");
    expect(placeAt(20, -30)).toBe("Mountain");
    expect(placeAt(0, -50)).toBe("Oracle Temple");
  });
  it("takes the nearest area off a deck's end or a river's bank, and none out at sea", () => {
    expect(placeAt(78.2, 41.1)).toBe("Wharf");
    expect(placeAt(-38, 46)).toBe("River");
    expect(placeAt(200, 200)).toBeNull();
  });
});
