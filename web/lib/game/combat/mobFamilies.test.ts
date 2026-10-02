import { describe, expect, it } from "vitest";
import { ENEMIES } from "./data";
import { familyOf, MOB_FAMILIES, RUNE_BOLT_SPEED } from "./mobFamilies";

describe("zone-1 mob families for the Transmuter's forms (identity only)", () => {
  it("names Fox, Crab, Wisp and Pollen, each from zone-1 mobs, with its colour, model and the sheet's role", () => {
    expect(Object.keys(MOB_FAMILIES)).toEqual(["fox", "crab", "wisp", "pollen"]);
    for (const f of Object.values(MOB_FAMILIES)) {
      expect(f.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(f.model).toMatch(/^\/assets\/game\/enemies\/.+\.glb$/);
      for (const id of f.from) { expect(ENEMIES[id], id).toBeDefined(); expect(ENEMIES[id].kind).toBe("wildlife"); }
      expect(f.role.click && f.role.shift).toBeTruthy();
    }
    expect(familyOf("elder-thorn-crab")?.key).toBe("crab");
    expect(familyOf("mushroom-beast")).toBeNull(); // the mushroom teaches no form
    expect(familyOf("stone-golem")).toBeNull(); // the Golem is the inner temple's, not zone 1's
  });
  it("borrows the mobs' live moves and mechanics", () => {
    expect(MOB_FAMILIES.fox.moves.shift).toBe(ENEMIES["shadow-fox"].attacks[0]);
    expect(MOB_FAMILIES.fox.moves.shift).toMatchObject({ shape: "pounce", leap: 3.6 });
    expect(MOB_FAMILIES.crab.trait.shell).toEqual(ENEMIES["thorn-crab"].shell);
    expect(MOB_FAMILIES.wisp.moves).toMatchObject({ click: { shape: "spit" }, shift: { shape: "blink", leap: 4 } });
    expect(RUNE_BOLT_SPEED).toBeGreaterThan(0);
    expect(MOB_FAMILIES.pollen.trait.hazard).toMatchObject({ kind: "pollen", slow: 0.35 });
  });
});
