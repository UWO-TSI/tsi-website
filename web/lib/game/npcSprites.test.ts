import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { npcSpriteSources } from "./npcSprites";
import { DEFAULT_NPC_PERSONAS } from "../../data/content-defaults";

it("resolves every permanent default NPC to art in the bundled library", () => {
  for (const persona of DEFAULT_NPC_PERSONAS) {
    const sources = npcSpriteSources(persona.sprite_url, persona.slug);
    for (const url of [sources.primary, sources.fallback]) {
      expect(existsSync(resolve(process.cwd(), "public", url.slice(1))), url).toBe(true);
    }
  }
});

it("preserves a configured custom sprite and supplies a stable bundled fallback", () => {
  const url = "https://example.com/custom-npc.png";
  const sources = npcSpriteSources(url, "custom-guide");
  expect(sources.primary).toBe(url);
  expect(npcSpriteSources(null, "custom-guide").primary).toBe(sources.fallback);
  expect(existsSync(resolve(process.cwd(), "public", sources.fallback.slice(1)))).toBe(true);
});
