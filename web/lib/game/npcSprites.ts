const BUNDLED_SPRITES = [
  "/assets/characters/npc/visitor-1.png",
  "/assets/characters/npc/wanderer-1.png",
  "/assets/characters/npc/stranger-1.png",
];

const LEGACY_SPRITES: Record<string, string> = {
  "/assets/characters/npc/mayor.png": BUNDLED_SPRITES[0],
  "/assets/characters/npc/shopkeeper.png": BUNDLED_SPRITES[2],
};

/** Preserve custom art while giving old seed URLs and failed uploads a real sprite. */
export function npcSpriteSources(spriteUrl: string | null, slug: string) {
  const hash = Array.from(slug).reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 0);
  const fallback = BUNDLED_SPRITES[hash % BUNDLED_SPRITES.length];
  return { primary: spriteUrl ? LEGACY_SPRITES[spriteUrl] ?? spriteUrl : fallback, fallback };
}
