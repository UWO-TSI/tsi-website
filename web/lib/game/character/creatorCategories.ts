/**
 * The creator's categories (Li'l Lads reference, David 2026-10-08): one per icon on the rail, each with its options
 * read from the catalogue and the face atlas, its colour swatches where the part takes a colour, its face sliders, and
 * how the portrait frames it. Pure: CharacterCreator draws it.
 *
 * Generic on purpose: options are whatever the catalogue holds for a slot (new hair or clothes drop in with no edit
 * here), the swatch row follows the parts' tinted materials, and a catalogue slot no category names gets a category
 * of its own at the end of the rail.
 */
import { FACE, PART_BY_ID, PARTS, partColor, wear, type AccGroup, type CharacterLook, type FaceLayer, type PartSlot, type PlacePart } from "./look";

/** How the portrait frames a category: the face up close, head and shoulders, from the waist up, or head to toe. */
export type Framing = "face" | "head" | "upper" | "body";
export type SwatchKind = "skin" | "hair" | "outfit";
/** The rail's icons (CreatorIcon draws ours; `item:` uses a real item icon). */
export type IconKey = "head" | "hair" | "eyes" | "brows" | "mouth" | "extras" | "part";

export interface Section {
  id: string;
  /** Shown above the section's tiles when a category has more than one. */
  label: string;
  /** A catalogue slot's parts (`null` in options: wear nothing, shoes only) or a face layer's cells. */
  source: { slot: PartSlot; group?: AccGroup } | { face: FaceLayer };
  options: (string | null)[];
}
export interface Category {
  id: string;
  label: string;
  icon: IconKey;
  /** A real item icon for the rail (public/assets/icons), when the category is clothes or accessories. */
  itemIcon?: string;
  framing: Framing;
  swatch: SwatchKind | null;
  /** The face sliders this category shows. */
  place?: PlacePart;
  sections: Section[];
  /** Offered in the closet and fitting room (hair and clothes; the face is the creator's alone). */
  wardrobe: boolean;
}

const parts = (slot: PartSlot, group?: AccGroup) => PARTS.filter(p => p.slot === slot && (!group || p.group === group)).map(p => p.id);
const slotSection = (id: string, label: string, slot: PartSlot, extra: (string | null)[] = [], group?: AccGroup): Section =>
  ({ id, label, source: { slot, group }, options: [...extra, ...parts(slot, group)] });
const faceSection = (layer: FaceLayer, label: string): Section => ({ id: layer, label, source: { face: layer }, options: Object.keys(FACE.layers[layer].items) });

/** A slot category's swatch: the outfit palette if its parts have an outfit-tinted material, else hair if hair-tinted. */
function partSwatch(sections: Section[]): SwatchKind | null {
  const tints = new Set(sections.flatMap(s => s.options.flatMap(id => (id ? PART_BY_ID.get(id)?.materials.map(m => m.tint) ?? [] : []))));
  return tints.has("outfit") ? "outfit" : tints.has("hair") ? "hair" : null;
}
const ACC_GROUPS: [AccGroup, string][] = [["face", "Glasses"], ["head", "Hats"], ["neck", "Neck"], ["bag", "Bags"]];
const SLOT_LABEL: Partial<Record<string, string>> = { bangs: "Fringe", back: "Back", top: "Tops", bottom: "Bottoms", onepiece: "One-pieces", shoes: "Shoes" };

function build(): Category[] {
  const hair = [slotSection("bangs", "Fringe", "bangs"), slotSection("back", "Back", "back")];
  const acc = ACC_GROUPS.map(([g, label]) => slotSection(`acc-${g}`, label, "accessory", [], g)).filter(s => s.options.length);
  const bottoms = [slotSection("bottom", "Bottoms", "bottom"), slotSection("onepiece", "One-pieces", "onepiece")];
  const cats: Category[] = [
    { id: "head", label: "Head & skin", icon: "head", framing: "face", swatch: "skin", sections: [], wardrobe: false },
    { id: "hair", label: "Hair", icon: "hair", framing: "head", swatch: partSwatch(hair), sections: hair, wardrobe: true },
    { id: "eyes", label: "Eyes", icon: "eyes", framing: "face", swatch: null, place: "eyes", sections: [faceSection("eyes", "Eyes")], wardrobe: false },
    { id: "brows", label: "Brows", icon: "brows", framing: "face", swatch: FACE.layers.brows.tint === "hair" ? "hair" : null, place: "brows", sections: [faceSection("brows", "Brows")], wardrobe: false },
    { id: "mouth", label: "Mouth", icon: "mouth", framing: "face", swatch: null, place: "mouth", sections: [faceSection("mouth", "Mouth")], wardrobe: false },
    { id: "extras", label: "Blush & extras", icon: "extras", framing: "face", swatch: null, sections: [faceSection("extras", "Extras")], wardrobe: false },
    { id: "accessories", label: "Accessories & glasses", icon: "part", itemIcon: "acc_glasses_round", framing: "head", swatch: partSwatch(acc), sections: acc, wardrobe: true },
    { id: "tops", label: "Tops", icon: "part", itemIcon: "top_tee", framing: "upper", swatch: partSwatch([slotSection("top", "Tops", "top")]), sections: [slotSection("top", "Tops", "top")], wardrobe: true },
    { id: "bottoms", label: "Bottoms", icon: "part", itemIcon: "bottom_trousers", framing: "body", swatch: partSwatch(bottoms), sections: bottoms.filter(s => s.options.length), wardrobe: true },
    { id: "shoes", label: "Shoes", icon: "part", itemIcon: "shoes_sneakers", framing: "body", swatch: partSwatch([slotSection("shoes", "Shoes", "shoes")]), sections: [slotSection("shoes", "Shoes", "shoes", [null])], wardrobe: true },
  ];
  // A slot the catalogue grows that no category above names: its own category, so its parts show without an edit here.
  const named = new Set(cats.flatMap(c => c.sections.flatMap(s => ("slot" in s.source ? [s.source.slot] : []))));
  for (const slot of [...new Set(PARTS.map(p => p.slot))].filter(s => !named.has(s))) {
    const sections = [slotSection(slot, SLOT_LABEL[slot] ?? slot, slot)];
    cats.push({ id: slot, label: SLOT_LABEL[slot] ?? slot[0].toUpperCase() + slot.slice(1), icon: "part", itemIcon: sections[0].options[0] ?? undefined, framing: "body", swatch: partSwatch(sections), sections, wardrobe: true });
  }
  return cats;
}
export const CATEGORIES: readonly Category[] = build();

/** An option's name: the part's, the face cell's creator name, or its place in the row ("Eyes, style 3 of 16"). */
export function optionName(section: Section, id: string | null): string {
  if (id === null) return "None";
  if ("slot" in section.source) return PART_BY_ID.get(id)?.name ?? id;
  return FACE.names[id] ?? ({ brow_soft: "Soft brows", brow_flat: "Flat brows", blush: "Blush", mole: "Mole", freckles: "Freckles" } as Record<string, string>)[id]
    ?? `${section.label}, style ${section.options.indexOf(id) + 1} of ${section.options.length}`;
}

/** Is this option what the look wears? */
export function isOn(look: CharacterLook, section: Section, id: string | null): boolean {
  const src = section.source;
  if ("face" in src) return src.face === "extras" ? look.extras.includes(id!) : look[src.face] === id;
  if (id === null) return (look as unknown as Record<string, unknown>)[src.slot] == null;
  if (src.slot === "accessory") return Object.values(look.acc).includes(id);
  return (look as unknown as Record<string, unknown>)[src.slot] === id;
}

/** Choose an option: wear a part (a second tap on an accessory takes it off), or set a face cell (extras toggle). */
export function choose(look: CharacterLook, section: Section, id: string | null): CharacterLook {
  const src = section.source;
  if ("face" in src) {
    if (src.face === "extras") return { ...look, extras: look.extras.includes(id!) ? look.extras.filter(e => e !== id) : [...look.extras, id!] };
    return { ...look, [src.face]: id! };
  }
  return id ? wear(look, PART_BY_ID.get(id)!.slot, id) : wear(look, src.slot, null);
}

/** The worn part a category's colour swatch recolours: the accessory chosen last (or the first worn), else the one worn. */
export function colourTarget(cat: Category, look: CharacterLook, lastAccessory: string | null): string | null {
  if (cat.swatch !== "outfit") return null;
  const worn = cat.sections.flatMap(s => s.options.filter((id): id is string => !!id && isOn(look, s, id) && partColor(look, id) !== null));
  return lastAccessory && worn.includes(lastAccessory) ? lastAccessory : worn[0] ?? null;
}
