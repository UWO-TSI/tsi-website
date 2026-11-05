import { describe, expect, it } from "vitest";
import { parseSkyLab } from "./skyLab";

describe("skyLab", () => {
  it("parses the switches and drops unknown values", () => {
    const s = parseSkyLab("?amb=motes,bogus&skytilt=12&skyface=sun&clouds=sprites&skypx=light");
    expect(s).toMatchObject({ tilt: 12, face: "sun", clouds: "sprites", skypx: "light" });
    expect([...s.amb]).toEqual(["motes"]);
    expect(parseSkyLab("?clouds=fluffy&skyface=up&skypx=heavy")).toMatchObject({ tilt: 0, face: null, clouds: null, skypx: null });
  });
});
