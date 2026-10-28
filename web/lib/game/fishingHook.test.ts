import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HOOK, HOOK_TIER, RARITY_META, type Rarity } from "./fishing";

describe("the hook's beat by tier", () => {
  it("gives legendary its golden hook, the top tier the divine one and everything else the common one", () => {
    expect(HOOK_TIER.legendary).toBe("legendary");
    expect(HOOK_TIER.divine).toBe("divine");
    for (const r of Object.keys(RARITY_META) as Rarity[]) if (r !== "legendary" && r !== "divine") expect(HOOK_TIER[r]).toBe("common");
  });

  it("hits harder up the tiers, each with its own bite sound on disk", () => {
    expect(HOOK.common.shake).toBeLessThan(HOOK.legendary.shake);
    expect(HOOK.legendary.shake).toBeLessThan(HOOK.divine.shake);
    expect(HOOK.common.punch).toBeLessThan(HOOK.divine.punch);
    const sounds = Object.values(HOOK).map((h) => h.sfx);
    expect(new Set(sounds).size).toBe(3);
    for (const s of sounds) expect(existsSync(join(__dirname, "../../public/audio/sfx", `${s}.ogg`))).toBe(true);
  });
});
