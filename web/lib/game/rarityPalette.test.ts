import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RARITY_META, REVEAL, type Rarity } from "./fishing";

/** One rarity palette (specs/polish/fishing.md deliverable 5): the GUI sheet's --gui-rarity-* tokens, everywhere. */
const css = readFileSync(new URL("../../styles/game-tokens.css", import.meta.url), "utf8");
const token = (name: string) => css.match(new RegExp(`--gui-${name}:\\s*(#[0-9a-f]{6})\\b`, "i"))?.[1]?.toLowerCase();
const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("one rarity palette across the catch card, the journal and the book", () => {
  it.each(Object.keys(RARITY_META) as Rarity[])("%s is the GUI sheet's token", r => {
    expect(token(`rarity-${r}`)).toBeDefined();
    expect(RARITY_META[r].color.toLowerCase()).toBe(token(`rarity-${r}`));
  });
  it("the card, the journal and the book draw rarity with the kit's rarity badge, not colours of their own", () => {
    for (const file of ["../../components/game/FishReveal.tsx", "../../components/game/JournalPages.tsx", "../../components/game/CollectionBook.tsx"]) {
      const src = source(file);
      expect(src, file).toMatch(/RarityBadge/);
      expect(src, file).not.toMatch(/RARITY_TONE|RARITY_META\[[^\]]+\]\.color/);
    }
  });
});

describe("the catch card's beats by tier (REVEAL)", () => {
  const tiers: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary", "seaking"];
  it("keeps a rarer first catch's silhouette longer, holds its card longer and shakes the camera harder", () => {
    for (let i = 1; i < tiers.length; i++) {
      const a = REVEAL[tiers[i - 1]], b = REVEAL[tiers[i]];
      expect(b.develop).toBeGreaterThan(a.develop);
      expect(b.hold).toBeGreaterThan(a.hold);
      expect(b.shake).toBeGreaterThan(a.shake);
    }
  });
  it("throws soft confetti only from rare up, and never a gacha's worth", () => {
    expect(REVEAL.common.confetti).toBe(0);
    expect(REVEAL.uncommon.confetti).toBe(0);
    expect(REVEAL.rare.confetti).toBeGreaterThan(0);
    for (const t of tiers) expect(REVEAL[t].confetti).toBeLessThanOrEqual(4);
  });
});
