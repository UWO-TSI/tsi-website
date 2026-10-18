"use client";

/**
 * The Collection in the flat UI (specs/polish/flat-ui.md step 6, round 2), the member world's and the phone's: the shop
 * overlay's panel with the journal's pages down an icon rail (fish, the sea floor, bugs, fruit, nature, rocks and ore),
 * every entry a white card, a silhouette until you find it. Hovering one (a long press on a phone, or focus) shows a
 * small card with its field notes: the name and rarity, where and when it's out, your record, the museum. A click opens
 * the side panel beside the grid with those notes and what you can do. No page of its own (David: "dont need lish fish
 * or bug click into its own page"). The pages come from /api/collections/journal when the server has them; otherwise
 * the book's own catalogue over what this browser has caught. The applicant island's card is CollectionBook's own.
 */
import { useRef, useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Apple, Bug, Check, Fish, Flower2, Gem, Landmark, Leaf, Pin, PinOff, Shell, Waves } from "lucide-react";
import { RarityBadge, SignInText, type BadgeRarity } from "@/components/gui";
import { CardGrid, DarkButton, FlatPanel, GhostButton, IconRail, ItemCard, Quiet, SidePanel, WithSide, flatStyles as f } from "@/components/gui/flat";
import PixelImage from "@/components/economy/PixelImage";
import { RARITY_META } from "@/lib/game/fishing";
import { iconUrl } from "@/lib/icons/keys";
import { pinnable } from "@/lib/game/itemModels";
import { togglePin, useHeld } from "@/lib/game/heldStore";
import { stockOf, useBag } from "@/lib/game/bagStore";
import { itemInfo } from "@/lib/collections/bag";
import { AudioManager } from "@/lib/game/audio";
import { localCollections, mergeWithLocal } from "@/lib/game/collections";
import type { Category } from "@/lib/collections/roster";
import type { JournalEntryKnown } from "@/lib/collections/logic";
import { fetchJournalPage } from "./JournalPages";
import { CATALOG, FISH_BY_KEY, collectionNote, type Sync } from "./CollectionBook";
import s from "./FlatCollection.module.css";

type Page = NonNullable<Awaited<ReturnType<typeof fetchJournalPage>>>;
const LABEL: Record<Category, string> = { fish: "Fish", sea: "Sea floor", bug: "Bugs", fruit: "Fruit", nature: "Nature", mineral: "Rocks and ore" };
const PAGE_ICON: Record<Category, ReactNode> = { fish: <Fish size={22} />, sea: <Shell size={22} />, bug: <Bug size={22} />, fruit: <Apple size={22} />, nature: <Leaf size={22} />, mineral: <Gem size={22} /> };
const GROUP_ICON: Record<string, ReactNode> = {
  Fruit: <Apple size={22} />, Flowers: <Flower2 size={22} />, "Shells and mushrooms": <Shell size={22} />, "Rocks and ore": <Gem size={22} />, Fish: <Fish size={22} />,
  "Sea Floor": <Waves size={22} />, Bugs: <Bug size={22} />, Shore: <Leaf size={22} />,
};
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** One entry, from a journal page or the book's own catalogue: what its card and its detail show. */
interface Entry {
  id: string;
  key: string | null;
  found: boolean;
  name: string;
  picture: string;
  rarity: BadgeRarity | null;
  kind: string;
  /** The one-liner (found) or the clue (not yet). */
  text: string;
  /** Its one-liner, once found (the side panel's quote). */
  quote: string | null;
  outNow: boolean;
  donated: boolean;
  /** The museum takes it. */
  donatable: boolean;
  notes: [string, string][];
}

function fromJournal(p: Page): Entry[] {
  return p.entries.map(e => {
    const when = e.available_now ? "Out right now" : e.later_today ? "Out later today" : "Not out right now";
    if (!e.discovered) return { id: `${p.category}-${e.slot}`, key: null, found: false, name: "???", picture: e.silhouette, rarity: null, kind: LABEL[p.category],
      text: e.clue, quote: null, outNow: e.available_now, donated: false, donatable: false, notes: [["Where and when", e.clue], ["Now", when]] };
    const k = e as JournalEntryKnown;
    return {
      id: `${p.category}-${k.slot}`, key: k.key, found: true, name: k.name, picture: k.icon ?? iconUrl(k.key), rarity: k.rarity as BadgeRarity, kind: LABEL[p.category],
      text: k.one_liner ? `“${k.one_liner}”` : k.clue, quote: k.one_liner ? `“${k.one_liner}”` : null, outNow: k.available_now, donated: k.museum.donated, donatable: k.donatable,
      notes: [
        ["Caught", `${k.total_collected.toLocaleString()}×${k.count ? ` · ${k.count} in your bag` : ""}`],
        ...(k.best_size_cm !== null || k.size_range ? [["Record", k.best_size_cm !== null ? `${k.best_size_cm} cm` : `${k.size_range![0]}-${k.size_range![1]} cm`] as [string, string]] : []),
        ["Where and when", k.clue],
        ["Now", when],
        ["Museum", k.museum.donated ? `On display, donated by ${k.museum.by_me ? "you" : k.museum.donor_name ?? "a member"}` : k.donatable ? "Not in the museum yet" : "The museum doesn't collect this"],
      ],
    };
  });
}

function fromCatalog(group: (typeof CATALOG)[number], counts: Record<string, number>): Entry[] {
  return group.items.map(it => {
    const found = Object.hasOwn(counts, it.key), fish = FISH_BY_KEY.get(it.key), sp = itemInfo(it.key);
    const rarity = (fish?.rarity ?? sp?.rarity ?? null) as BadgeRarity | null;
    const notes: [string, string][] = [["Caught", `${(counts[it.key] ?? 0).toLocaleString()}×`]];
    if (fish) notes.push(["Bites", fish.whenLabel ?? "Any time"], ["Size", `${fish.sizeCm[0]}-${fish.sizeCm[1]} cm`], ["Where", (fish.zone ?? "river") === "sea" ? "The sea" : "The river"]);
    return { id: it.key, key: it.key, found, name: found ? it.name : "???", picture: iconUrl(it.key), rarity: found ? rarity : null, kind: group.group,
      text: found ? (fish ? `Bites ${fish.whenLabel ?? "any time"}.` : "In your collection.") : "Not found yet.", quote: null, outNow: false, donated: false, donatable: !!sp?.donatable || !!fish,
      notes: found ? notes : [["Found", "Not yet"]] };
  });
}

export default function FlatCollection({ open, onClose, keys }: { open: boolean; onClose: () => void; keys?: string }) {
  const [counts, setCounts] = useState(() => localCollections());
  const [sync, setSync] = useState<Sync>("loading");
  const [page, setPage] = useState<Page | null>(null);
  const [category, setCategory] = useState<Category>("fish");
  const [group, setGroup] = useState(CATALOG.find(g => g.group === "Fish")!.group);
  const [picked, setPicked] = useState<string | null>(null);
  const [fishFilter, setFishFilter] = useState<"all" | "river" | "sea" | "caught">("all");

  // Each opening starts on the grid and reads the book again: the counts, then the journal's page.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) { setWasOpen(open); if (open) setPicked(null); }
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let alive = true;
    fetch("/api/collections", { signal: controller.signal }).then(async r => {
      if (r.status === 401) { if (alive) setSync("signed-out"); return; }
      if (!r.ok) throw new Error("Collection sync unavailable");
      const d: { collections?: { item_key: string; count: number }[] } = await r.json();
      if (!Array.isArray(d.collections)) throw new Error("Invalid collection response");
      if (alive) { setCounts(mergeWithLocal(Object.fromEntries(d.collections.map(row => [row.item_key, row.count])))); setSync("synced"); }
    }).catch(() => { if (alive) setSync("local"); });
    return () => { alive = false; controller.abort(); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void fetchJournalPage(category).then(p => { if (alive && p) { setPage(p); setPicked(null); } });
    return () => { alive = false; };
  }, [open, category]);

  const discovered = CATALOG.reduce((n, g) => n + g.items.filter(it => Object.hasOwn(counts, it.key)).length, 0);
  const totalKinds = CATALOG.reduce((n, g) => n + g.items.length, 0);
  const caught = Object.values(counts).reduce((a, b) => a + b, 0);
  const note = collectionNote(undefined, sync);

  const catalogGroup = CATALOG.find(g => g.group === group) ?? CATALOG[0];
  const entries = useMemo(() => {
    if (page) return fromJournal(page);
    const all = fromCatalog(catalogGroup, counts);
    if (catalogGroup.group !== "Fish" || fishFilter === "all") return all;
    return all.filter((e, i) => {
      const zone = catalogGroup.items[i].zone;
      return fishFilter === "river" ? zone !== "sea" : fishFilter === "sea" ? zone === "sea" : e.found;
    });
  }, [page, catalogGroup, counts, fishFilter]);
  const entry = entries.find(e => e.id === picked) ?? null;
  const title = page ? LABEL[page.category] : catalogGroup.group;
  const got = page ? page.discovered : catalogGroup.items.filter(it => Object.hasOwn(counts, it.key)).length;
  const of = page ? page.total : catalogGroup.items.length;

  const rail = page
    ? <IconRail label="Journal pages" value={page.category} onChange={c => { setCategory(c); setPicked(null); }}
      items={page.categories.map(c => ({ id: c.category, label: `${LABEL[c.category]}, ${c.discovered} of ${c.total}`, icon: PAGE_ICON[c.category] }))} />
    : <IconRail label="Collection" value={group} onChange={g => { setGroup(g); setPicked(null); }} items={CATALOG.map(g => ({ id: g.group, label: g.group, icon: GROUP_ICON[g.group] }))} />;

  return <FlatPanel open={open} onClose={onClose} title="Collection" keys={keys} testId="collection-sheet" rail={rail} contentKey={page ? page.category : group}
    purse={<span className={s.summary}>{discovered}/{totalKinds} kinds discovered · {caught} caught</span>}>
    {note && <p className={s.note} role="status"><SignInText text={note} /></p>}
    <div className={s.head}>
      <h3 className={f.shelfTitle}>{title}</h3>
      <span className={s.count} data-done={got === of || undefined}>{got === of ? <Check size={14} strokeWidth={3} aria-label="Complete" /> : null}{got}/{of}</span>
      {!page && catalogGroup.group === "Fish" && <span className={s.filters} role="group" aria-label="Show">
        {([["all", "All"], ["river", "River"], ["sea", "Sea"], ["caught", "Discovered"]] as const).map(([k, label]) =>
          <GhostButton key={k} aria-pressed={fishFilter === k} data-on={fishFilter === k || undefined} onClick={() => setFishFilter(k)}>{label}</GhostButton>)}
      </span>}
    </div>
    {entries.length === 0 ? <Quiet>Nothing here yet.</Quiet>
      : <WithSide side={entry ? <EntryPanel key={entry.id} e={entry} onClose={() => setPicked(null)} /> : null}>
        <Entries entries={entries} picked={picked} onPick={id => { setPicked(id === picked ? null : id); AudioManager.playSFX("blip1"); }} />
      </WithSide>}
  </FlatPanel>;
}

/** Where the small card shows, in the grid's own box: centred over the tile (under it when the tile is near the top), kept inside. */
type Peek = { id: string; x: number; y: number; above: boolean };
const LONG_PRESS_MS = 450, PEEK_HALF = 135, PEEK_ROOM = 230;
/** The card's place for a tile (`tile`) in the grid's box (`box`), both screen rects; `top`: where the visible area starts. */
export function peekAt(box: { left: number; top: number; width: number }, tile: { left: number; top: number; bottom: number; width: number }, top: number): Omit<Peek, "id"> {
  const above = tile.top - top > PEEK_ROOM;
  const x = Math.max(PEEK_HALF, Math.min(box.width - PEEK_HALF, tile.left - box.left + tile.width / 2));
  return { x, y: above ? tile.top - box.top - 8 : tile.bottom - box.top + 8, above };
}

/** The grid of entries, with the hover card (a long press on a phone, or focus). */
function Entries({ entries, picked, onPick }: { entries: Entry[]; picked: string | null; onPick: (id: string) => void }) {
  const [peek, setPeek] = useState<Peek | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // A long press shows the card; the click that ends it doesn't also pick the tile.
  const press = useRef<{ id: string; timer: number; fired: boolean } | null>(null);
  const show = (id: string, el: HTMLElement) => {
    const box = boxRef.current;
    if (!box) return;
    const scroller = box.closest("main, section") ?? box;
    setPeek({ id, ...peekAt(box.getBoundingClientRect(), el.getBoundingClientRect(), scroller.getBoundingClientRect().top) });
  };
  const down = (id: string) => (ev: ReactPointerEvent<HTMLDivElement>) => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
    if (ev.pointerType === "mouse") return;
    const el = ev.currentTarget, mine = { id, fired: false, timer: 0 };
    mine.timer = window.setTimeout(() => { mine.fired = true; show(id, el); }, LONG_PRESS_MS);
    press.current = mine;
  };
  const up = () => { if (press.current) window.clearTimeout(press.current.timer); if (press.current?.fired) setPeek(null); };
  const shown = peek ? entries.find(e => e.id === peek.id) ?? null : null;
  return <div ref={boxRef} className={s.entries}>
    <CardGrid min={150} phoneMin={104}>{entries.map(e => <div key={e.id} className={s.cell}
      onPointerEnter={ev => { if (ev.pointerType === "mouse") show(e.id, ev.currentTarget); }} onPointerLeave={() => setPeek(p => (p?.id === e.id ? null : p))}
      onPointerDown={down(e.id)} onPointerUp={up} onPointerCancel={up}
      onFocus={ev => { if ((ev.target as HTMLElement).matches?.(":focus-visible")) show(e.id, ev.currentTarget); }} onBlur={() => setPeek(p => (p?.id === e.id ? null : p))}
      onClickCapture={ev => { const p = press.current; press.current = null; if (p?.fired && p.id === e.id) { ev.stopPropagation(); ev.preventDefault(); } }}>
      <ItemCard size="sm" arrow={false} picture={e.picture} px={40} name={e.name} selected={picked === e.id}
        line={e.found ? <>{e.rarity ? <i className={s.rarity} style={{ background: `var(--gui-rarity-${e.rarity})` }} aria-hidden /> : null}{e.rarity ? cap(e.rarity) : e.kind}</> : "Not found yet"}
        pill={e.donated ? <Landmark size={12} aria-label="On display at the museum" /> : null} tag={e.outNow ? "Out now" : null} cover={e.found ? null : "not-found"}
        onClick={() => { setPeek(null); onPick(e.id); }} label={e.found ? e.name : `Undiscovered · ${e.text}`} />
    </div>)}</CardGrid>
    {peek && shown && <div className={s.peek} role="tooltip" data-above={peek.above || undefined} style={{ left: peek.x, top: peek.y }}>
      <p className={s.peekName}>{shown.found ? shown.name : "Undiscovered"}{shown.rarity ? <RarityBadge rarity={shown.rarity}>{RARITY_META[shown.rarity as keyof typeof RARITY_META]?.label ?? shown.rarity}</RarityBadge> : null}</p>
      <dl className={s.peekNotes}>{shown.notes.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    </div>}
  </div>;
}

/** The picked entry in the side panel beside the grid: its notes, and what you can do (pin it, where to donate it). */
function EntryPanel({ e, onClose }: { e: Entry; onClose: () => void }) {
  const bag = useBag(), { pins } = useHeld();
  const inBag = e.key ? stockOf(bag.view)[e.key] ?? 0 : 0;
  const pinned = !!e.key && pins.includes(e.key);
  return <SidePanel testId="collection-entry" onClose={onClose} picture={e.found ? e.picture : <span className={s.sideSilhouette}><PixelImage src={e.picture} px={40} /></span>}
    title={e.found ? e.name : "Undiscovered"} kind={<span className={s.kind}>{e.kind}{e.rarity ? <RarityBadge rarity={e.rarity}>{RARITY_META[e.rarity as keyof typeof RARITY_META]?.label ?? e.rarity}</RarityBadge> : null}</span>}
    facts={e.notes}
    actions={e.key && inBag > 0 && pinnable(e.key) ? <DarkButton onClick={() => togglePin(e.key!)}>
      <span className={s.withIcon}>{pinned ? <PinOff size={15} aria-hidden /> : <Pin size={15} aria-hidden />} {pinned ? "Unpin from the wheel" : "Pin to the wheel"}</span></DarkButton> : null}>
    {e.found ? e.quote && <p className={s.text}>{e.quote}</p> : <p className={s.text}>{e.text}</p>}
    {e.found && e.donatable && !e.donated && inBag > 0 && <p className={s.museum}><Landmark size={14} aria-hidden /> Bring it to the curator to put it on show.</p>}
  </SidePanel>;
}

