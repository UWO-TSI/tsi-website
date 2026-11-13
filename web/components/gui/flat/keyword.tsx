"use client";

/**
 * The icon library for talk (David's v3 review: "use simple 2d icon for fish bug word and make it color and shake a
 * lil"; v4: "always add colored icon in text that makes sense and wiggle it a bit"; v5: "make a icon library that
 * matches words to icons so all future convo uses colored icons"). A keyword is the word in its colour with a little
 * flat icon before it that wiggles gently. Every talk line goes through it (design bible UI, rule 8c): `keywordParts`
 * finds the library's words in any line (whole words, any case, the longest phrase first, so "fish market" is the
 * market and "fishing rod" the rod), no marking needed. A new thing in the game that people talk about gets its row
 * here, never a one-off icon in a line. Colours: the theme's --ui-word-* tokens, one per tone. The whole library is on
 * /lab/gui?only=keyword-library.
 *
 * Round 6 review: "expand the icon library n the same design, then slowly impliment these icons so its uniform". The
 * UI's own words are rows too (menus, weather, gear, places), and the UI draws a thing's icon from here
 * (`KeywordIcon`: the kind's icon on its own, in its tone, still) so the bag is the same backpack in the dock, the bag's
 * rail and a talk line. UI text (toasts, the tour's cards) goes through `KeywordLine` like talk does.
 */
import type { CSSProperties, ReactNode } from "react";
import {
  Anchor, Apple, Archive, ArrowLeftRight, Axe, Backpack, BadgeCheck, Barrel, BatteryMedium, Bird, Bone, BookMarked, BookOpen, Bug,
  Building2, Camera, Castle, ClipboardList, CloudRain, Coffee, Compass, CookingPot, Crown, Droplets, Eye, Fish, Flag, Flame, Flower2,
  Footprints, Gamepad2, Gift, Hammer, HandCoins, HandHeart, Heart, HeartPulse, House, IdCard, KeyRound, LandPlot, Landmark, Leaf,
  Library, Mail, Map as MapIcon, MessageCircle, Milestone, Moon, Mountain, MoveUp, Music, NotebookPen, PackageCheck, PackageOpen,
  Paintbrush, PartyPopper, Pickaxe, QrCode, ScrollText, Settings, Shell, Shield, Shirt, Ship, ShoppingBasket, ShoppingCart, Shovel,
  Skull, Smartphone, Smile, Snowflake, Sofa, Sparkles, Sprout, Star, Sticker, Store, Sunrise, Sword, Swords, TreeDeciduous, TreePalm,
  Trophy, Umbrella, Unlock, UserRound, Users, Utensils, Volleyball, Wallet, Waves, Wind, Worm, Wrench, Zap,
} from "lucide-react";
import { CurrencyIcon } from "@/components/economy/Amount";
import k from "./keyword.module.css";

/** A fishing rod, drawn as lucide draws (24 box, round strokes): the rod, its reel, the line and the hook. */
function Rod() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 21 19 4" /><circle cx="7.5" cy="16" r="2" /><path d="M19 4c1.5 3 1.5 7 0 10" /><path d="M19 14v2.5a1.5 1.5 0 0 1-3 0" />
  </svg>;
}
/** A bug net, drawn the same way: the handle, the hoop and its mesh. */
function Net() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 21 11 13" /><circle cx="15.5" cy="8.5" r="5.5" /><path d="M12 5.5 19 12.5M10.6 9.5l5-4.9M14 14l5.4-5.4" />
  </svg>;
}

/** A keyword's colour (its --ui-word-* token): creatures, money, places, things, people's roles, things you do. */
export type Tone = "fish" | "bug" | "coin" | "gem" | "place" | "item" | "person" | "act";
/** The library: each kind's icon, its tone and the words (and phrases) that name it. */
const KEYWORDS = {
  // Creatures.
  fish: { icon: <Fish />, tone: "fish", words: ["fish", "fishes", "fishing"] },
  shell: { icon: <Shell />, tone: "fish", words: ["shell", "shells", "seashell", "seashells", "sea creature", "sea creatures", "crab", "crabs", "clam", "clams"] },
  bug: { icon: <Bug />, tone: "bug", words: ["bug", "bugs", "insect", "insects", "beetle", "beetles", "butterfly", "butterflies", "firefly", "fireflies", "ladybug", "ladybugs", "dragonfly", "dragonflies", "cicada", "cicadas"] },
  bird: { icon: <Bird />, tone: "bug", words: ["bird", "birds", "gull", "gulls"] },
  bait: { icon: <Worm />, tone: "bug", words: ["bait", "worm", "worms"] },
  fossil: { icon: <Bone />, tone: "bug", words: ["fossil", "fossils"] },
  monster: { icon: <Skull />, tone: "bug", words: ["monster", "monsters", "enemy", "enemies"] },
  // Money and what it buys.
  coin: { icon: <CurrencyIcon size={18} />, tone: "coin", words: ["coin", "coins"] },
  gem: { icon: <CurrencyIcon currency="gems" size={18} />, tone: "gem", words: ["gem", "gems"] },
  merch: { icon: <PackageOpen />, tone: "gem", words: ["merch"] },
  reward: { icon: <Trophy />, tone: "gem", words: ["reward", "rewards", "prize", "prizes", "trophy", "trophies"] },
  wallet: { icon: <Wallet />, tone: "coin", words: ["wallet"] },
  gathering: { icon: <PartyPopper />, tone: "gem", words: ["gathering", "gatherings", "event", "events", "Genesis"] },
  // Things you carry and use.
  rod: { icon: <Rod />, tone: "item", words: ["rod", "rods", "fishing rod"] },
  net: { icon: <Net />, tone: "item", words: ["net", "nets", "bug net"] },
  shovel: { icon: <Shovel />, tone: "item", words: ["shovel", "shovels", "spade"] },
  pickaxe: { icon: <Pickaxe />, tone: "item", words: ["pickaxe", "pickaxes"] },
  axe: { icon: <Axe />, tone: "item", words: ["axe"] },
  tool: { icon: <Wrench />, tone: "item", words: ["tool", "tools"] },
  bag: { icon: <Backpack />, tone: "item", words: ["bag", "backpack", "pockets", "inventory"] },
  clothes: { icon: <Shirt />, tone: "item", words: ["clothes", "outfit", "outfits", "hat", "hats"] },
  furniture: { icon: <Sofa />, tone: "item", words: ["furniture"] },
  fruit: { icon: <Apple />, tone: "item", words: ["fruit", "apple", "apples", "coconut", "coconuts"] },
  flower: { icon: <Flower2 />, tone: "item", words: ["flower", "flowers"] },
  rock: { icon: <Mountain />, tone: "item", words: ["rock", "rocks", "stone", "stones", "ore"] },
  recipe: { icon: <NotebookPen />, tone: "item", words: ["recipe", "recipes"] },
  quest: { icon: <ScrollText />, tone: "item", words: ["quest", "quests", "task", "tasks"] },
  gift: { icon: <Gift />, tone: "item", words: ["gift", "gifts"] },
  id: { icon: <IdCard />, tone: "item", words: ["ID", "ID card"] },
  mail: { icon: <Mail />, tone: "item", words: ["mail", "mailbox", "letter", "letters"] },
  map: { icon: <MapIcon />, tone: "item", words: ["map", "minimap"] },
  phone: { icon: <Smartphone />, tone: "item", words: ["phone"] },
  qr: { icon: <QrCode />, tone: "item", words: ["QR", "QR code", "check-in", "check in"] },
  xp: { icon: <Star />, tone: "item", words: ["XP", "level", "levels", "level up"] },
  health: { icon: <HeartPulse />, tone: "item", words: ["health", "heal", "heals"] },
  stamina: { icon: <BatteryMedium />, tone: "item", words: ["stamina", "energy"] },
  collection: { icon: <BookMarked />, tone: "item", words: ["collection", "collections", "catalogue"] },
  settings: { icon: <Settings />, tone: "item", words: ["settings"] },
  chest: { icon: <Archive />, tone: "item", words: ["chest", "storage"] },
  photo: { icon: <Camera />, tone: "item", words: ["photo", "photos", "camera"] },
  sticker: { icon: <Sticker />, tone: "item", words: ["sticker", "stickers"] },
  keychain: { icon: <KeyRound />, tone: "item", words: ["keychain", "keychains", "lanyard", "lanyards"] },
  glider: { icon: <Leaf />, tone: "item", words: ["glider", "leaf glider"] },
  seed: { icon: <Sprout />, tone: "item", words: ["seed", "seeds", "sapling", "saplings"] },
  tree: { icon: <TreeDeciduous />, tone: "item", words: ["tree", "trees", "wood", "branch", "branches"] },
  food: { icon: <Utensils />, tone: "item", words: ["food", "meal", "meals", "dish", "dishes", "sushi", "snack", "snacks"] },
  weapon: { icon: <Sword />, tone: "item", words: ["sword", "swords", "weapon", "weapons"] },
  shield: { icon: <Shield />, tone: "item", words: ["shield", "shields"] },
  // Places.
  island: { icon: <TreePalm />, tone: "place", words: ["island", "Tethos", "Tethos Island"] },
  beach: { icon: <Umbrella />, tone: "place", words: ["beach", "shore"] },
  sea: { icon: <Waves />, tone: "place", words: ["sea", "ocean", "water"] },
  wharf: { icon: <Anchor />, tone: "place", words: ["wharf", "dock", "pier", "quay"] },
  ship: { icon: <Ship />, tone: "place", words: ["ship", "ships", "boat", "boats", "shipwright", "shipyard"] },
  shop: { icon: <Store />, tone: "place", words: ["shop", "tackle shop"] },
  market: { icon: <ShoppingBasket />, tone: "place", words: ["market", "fish market"] },
  cafe: { icon: <Coffee />, tone: "place", words: ["café", "cafe", "coffee"] },
  museum: { icon: <Landmark />, tone: "place", words: ["museum"] },
  hq: { icon: <Building2 />, tone: "place", words: ["HQ", "clubhouse"] },
  river: { icon: <Droplets />, tone: "place", words: ["river", "rivers", "pond", "ponds", "stream"] },
  monument: { icon: <Milestone />, tone: "place", words: ["monument", "plaza"] },
  plot: { icon: <LandPlot />, tone: "place", words: ["plot", "plots"] },
  library: { icon: <Library />, tone: "place", words: ["library"] },
  board: { icon: <ClipboardList />, tone: "place", words: ["notice board", "job board", "bounty", "bounties"] },
  campfire: { icon: <Flame />, tone: "place", words: ["campfire", "bonfire"] },
  oracle: { icon: <Eye />, tone: "place", words: ["oracle", "temple", "shrine"] },
  rain: { icon: <CloudRain />, tone: "place", words: ["rain", "rainy", "storm", "storms"] },
  snow: { icon: <Snowflake />, tone: "place", words: ["snow", "snowy", "winter"] },
  dawn: { icon: <Sunrise />, tone: "place", words: ["dawn", "dusk", "sunrise", "sunset"] },
  night: { icon: <Moon />, tone: "place", words: ["night", "nights", "tonight"] },
  home: { icon: <House />, tone: "place", words: ["home", "house"] },
  ruins: { icon: <Castle />, tone: "place", words: ["ruins"] },
  barrel: { icon: <Barrel />, tone: "place", words: ["barrel"] },
  // People, by what they are to you or what they do.
  friend: { icon: <Users />, tone: "person", words: ["friend", "friends", "neighbour", "neighbours", "neighbor", "neighbors"] },
  heart: { icon: <Heart />, tone: "person", words: ["heart", "hearts", "friendship"] },
  member: { icon: <BadgeCheck />, tone: "person", words: ["member", "members", "resident", "residents"] },
  player: { icon: <Gamepad2 />, tone: "person", words: ["player", "players"] },
  founder: { icon: <Crown />, tone: "person", words: ["Founder"] },
  curator: { icon: <Landmark />, tone: "person", words: ["curator"] },
  keeper: { icon: <Store />, tone: "person", words: ["shopkeeper", "wharf keeper", "barista", "chef"] },
  guide: { icon: <Compass />, tone: "person", words: ["guide", "guides"] },
  guest: { icon: <UserRound />, tone: "person", words: ["guest", "guests", "visitor", "visitors"] },
  club: { icon: <Flag />, tone: "person", words: ["club"] },
  // Things you do.
  study: { icon: <BookOpen />, tone: "act", words: ["study", "studying"] },
  sell: { icon: <HandCoins />, tone: "act", words: ["sell", "sells", "selling", "sold"] },
  buy: { icon: <ShoppingCart />, tone: "act", words: ["buy", "buys", "bought"] },
  donate: { icon: <HandHeart />, tone: "act", words: ["donate", "donates", "donated", "donation"] },
  trade: { icon: <ArrowLeftRight />, tone: "act", words: ["trade", "trades", "traded", "trading"] },
  craft: { icon: <Hammer />, tone: "act", words: ["craft", "crafts", "crafting"] },
  cook: { icon: <CookingPot />, tone: "act", words: ["cook", "cooking"] },
  dig: { icon: <Shovel />, tone: "act", words: ["dig", "digging"] },
  cast: { icon: <Rod />, tone: "act", words: ["cast", "casting"] },
  jump: { icon: <MoveUp />, tone: "act", words: ["jump", "hop"] },
  dash: { icon: <Zap />, tone: "act", words: ["dash"] },
  explore: { icon: <Footprints />, tone: "act", words: ["explore", "exploring"] },
  chat: { icon: <MessageCircle />, tone: "act", words: ["chat"] },
  emote: { icon: <Smile />, tone: "act", words: ["emote", "emotes"] },
  dance: { icon: <Music />, tone: "act", words: ["dance", "dances", "dancing"] },
  glide: { icon: <Wind />, tone: "act", words: ["glide", "gliding"] },
  decorate: { icon: <Paintbrush />, tone: "act", words: ["decorate", "decorating", "decor"] },
  deliver: { icon: <PackageCheck />, tone: "act", words: ["deliver", "delivers", "delivery", "deliveries", "hand in"] },
  fight: { icon: <Swords />, tone: "act", words: ["fight", "fights", "battle", "battles", "combat"] },
  unlock: { icon: <Unlock />, tone: "act", words: ["unlock", "unlocks", "unlocked"] },
  volleyball: { icon: <Volleyball />, tone: "act", words: ["volleyball"] },
  rare: { icon: <Sparkles />, tone: "gem", words: ["rare"] },
} satisfies Record<string, { icon: ReactNode; tone: Tone; words: string[] }>;
export type KeywordKind = keyof typeof KEYWORDS;

const KIND_OF = new Map(Object.entries(KEYWORDS).flatMap(([kind, e]) => e.words.map(w => [w.toLowerCase(), kind as KeywordKind] as const)));
/** Any dictionary word standing alone (not inside another word), the longest first; a phrase's space may be any space. */
const WORDS = new RegExp(`(?<![\\p{L}'])(${[...KIND_OF.keys()].sort((a, b) => b.length - a.length).map(w => w.replace(/ /g, "\\s+")).join("|")})(?!\\p{L})`, "giu");

/** A line's parts: plain text, and keywords. `at`: where the part starts in the line. */
export type LinePart = { text: string; at: number; kind?: KeywordKind };
export function keywordParts(line: string): LinePart[] {
  const parts: LinePart[] = [];
  let last = 0;
  for (const m of line.matchAll(WORDS)) {
    const at = m.index;
    if (at > last) parts.push({ text: line.slice(last, at), at: last });
    parts.push({ text: m[0], at, kind: KIND_OF.get(m[0].toLowerCase().replace(/\s+/g, " "))! });
    last = at + m[0].length;
  }
  if (last < line.length) parts.push({ text: line.slice(last), at: last });
  return parts;
}

/** The keyword itself. `off`: not yet reached (a line typing out): its room is kept, its icon not shown. */
export function Keyword({ kind, off, children }: { kind: KeywordKind; off?: boolean; children: ReactNode }) {
  const e = KEYWORDS[kind];
  return <span className={k.word} data-tone={e.tone} data-off={off || undefined}><i className={k.icon} aria-hidden="true">{e.icon}</i>{children}</span>;
}
/** A kind's icon on its own, for the UI (a menu entry, a rail, a tab): the same drawing in its tone, still. `size` in px. */
export function KeywordIcon({ kind, size = 20 }: { kind: KeywordKind; size?: number }) {
  return <i className={k.glyph} data-tone={KEYWORDS[kind].tone} style={{ "--g": `${size}px` } as CSSProperties} aria-hidden="true">{KEYWORDS[kind].icon}</i>;
}
/** The icon itself (tests, and a piece that draws it its own way). */
export const keywordIcon = (kind: KeywordKind): ReactNode => KEYWORDS[kind].icon;
/** A whole line with its keywords. */
export function KeywordLine({ line }: { line: string }) {
  return <>{keywordParts(line).map(p => (p.kind ? <Keyword key={p.at} kind={p.kind}>{p.text}</Keyword> : <span key={p.at}>{p.text}</span>))}</>;
}
/** Every keyword kind, for the showroom. */
export const KEYWORD_KINDS = Object.keys(KEYWORDS) as KeywordKind[];
/** The library as data, for the kit page: each kind's tone and words. */
export const KEYWORD_LIBRARY = KEYWORD_KINDS.map(kind => ({ kind, tone: KEYWORDS[kind].tone as Tone, words: KEYWORDS[kind].words as readonly string[] }));
