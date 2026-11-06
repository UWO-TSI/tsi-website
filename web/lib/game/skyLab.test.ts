import { describe, expect, it } from "vitest";
import { parseSkyLab } from "./skyLab";

describe("skyLab", () => {
  it("parses the switches and drops unknown values", () => {
    const s = parseSkyLab("?amb=motes,bogus&skytilt=12&skyface=sun");
    expect(s).toMatchObject({ tilt: 12, face: "sun" });
    expect([...s.amb]).toEqual(["motes"]);
    expect(parseSkyLab("?skyface=up")).toMatchObject({ tilt: 0, face: null });
  });
});
