/**
 * How the club merch is laid out in the shop (David's reference, references/ui/shop/2026-10-18-ref-merch-grid.png):
 * each item's kind, for the filter pills (apparel, accessories, stickers, home), and its optional tag (staff pick, new
 * drop). Merch rows carry neither yet, so the kind comes from the name and the tags from this list. A merch row David
 * adds gets its kind without a code change; tagging one is a line here until the catalogue has a column for it.
 */
export type MerchKind = "apparel" | "accessories" | "stickers" | "home";
export const MERCH_KINDS: readonly { id: MerchKind; label: string }[] = [
  { id: "apparel", label: "apparel" },
  { id: "accessories", label: "accessories" },
  { id: "stickers", label: "stickers" },
  { id: "home", label: "home" },
];

const RULES: readonly [RegExp, MerchKind][] = [
  [/\b(tee|t-shirt|shirt|hoodie|crewneck|crew|sweater|jacket|quarter-zip|zip|sock|beanie|hat)\b/, "apparel"],
  [/\b(sticker|decal|pin|patch|button)s?\b/, "stickers"],
  [/\b(mug|cup|bottle|poster|print|blanket|notebook|planner|candle|coaster)s?\b/, "home"],
  [/\b(tote|bag|cap|lanyard|keychain|key-chain|strap|case)s?\b/, "accessories"],
];
/** An item's kind, from its slug and name; anything unrecognised is an accessory. */
export function merchKind(item: { slug: string; name: string }): MerchKind {
  const text = `${item.slug.replace(/-/g, " ")} ${item.name}`.toLowerCase();
  return RULES.find(([re]) => re.test(text))?.[1] ?? "accessories";
}

export type MerchTag = "staff pick" | "new drop";
/** The items with a tag on their card. */
export const MERCH_TAGS: Readonly<Record<string, MerchTag>> = {
  "merch-tote": "staff pick",
  "merch-tsi-keycap-keychain": "new drop",
};
export const merchTag = (slug: string): MerchTag | null => MERCH_TAGS[slug] ?? null;

/** The pills to show: "all", then each kind that has something in it, in order. */
export function merchFilters(items: readonly { slug: string; name: string }[]): ("all" | MerchKind)[] {
  const kinds = new Set(items.map(merchKind));
  return ["all", ...MERCH_KINDS.map(k => k.id).filter(k => kinds.has(k))];
}

/** The spec row under an item in the shop's detail view, where it has its own (the parts it's made of). */
export const MERCH_SPECS: Readonly<Record<string, [string, string][]>> = {
  "merch-tsi-keycap-keychain": [["Switch", "Gateron Milky Yellow Pro"], ["Keycap", "TSI navy, the Tethos mark"], ["Pick up", "HQ on campus"]],
  "merch-tsi-lanyard": [["Strap", "Navy, printed both sides"], ["Hardware", "Silver D-ring, swivel snap hook"], ["Pick up", "HQ on campus"]],
};
export const merchSpecs = (slug: string): [string, string][] | null => MERCH_SPECS[slug] ?? null;
