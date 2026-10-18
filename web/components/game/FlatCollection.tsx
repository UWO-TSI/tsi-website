"use client";

/**
 * The Collection in the flat UI (specs/polish/flat-ui.md step 6), the member world's and the phone's: the shop overlay's
 * panel with the journal's pages down an icon rail (fish, the sea floor, bugs, fruit, nature, rocks and ore), every
 * entry a white card, a silhouette until you find it, and one opened on the white studio stage (turning, where it has a
 * model) with its field notes: the one-liner or the clue, when it's out, your catches and record, the museum. The pages
 * come from /api/collections/journal when the server has them; otherwise the book's own catalogue over what this
 * browser has caught. The applicant island's card is CollectionBook's own and doesn't come here.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Apple, Bug, Check, Fish, Flower2, Gem, Landmark, Leaf, Shell, Waves } from "lucide-react";
import { RarityBadge, SignInText, type BadgeRarity } from "@/components/gui";
import { CardGrid, DetailView, FlatPanel, GhostButton, IconRail, InfoHead, ItemCard, Quiet, STAGE, flatStyles as f } from "@/components/gui/flat";
import ItemViewer from "@/components/economy/ItemViewer";
import PixelImage from "@/components/economy/PixelImage";
import { RARITY_META } from "@/lib/game/fishing";
import { iconUrl } from "@/lib/icons/keys";
import { keyModel } from "@/lib/icons/itemModel";
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
  outNow: boolean;
  donated: boolean;
  notes: [string, string][];
}

function fromJournal(p: Page): Entry[] {
  return p.entries.map(e => {
    const when = e.available_now ? "Out right now" : e.later_today ? "Out later today" : "Not out right now";
    if (!e.discovered) return { id: `${p.category}-${e.slot}`, key: null, found: false, name: "???", picture: e.silhouette, rarity: null, kind: LABEL[p.category],
      text: e.clue, outNow: e.available_now, donated: false, notes: [["Where and when", e.clue], ["Now", when]] };
    const k = e as JournalEntryKnown;
    return {
      id: `${p.category}-${k.slot}`, key: k.key, found: true, name: k.name, picture: k.icon ?? iconUrl(k.key), rarity: k.rarity as BadgeRarity, kind: LABEL[p.category],
      text: k.one_liner ? `“${k.one_liner}”` : k.clue, outNow: k.available_now, donated: k.museum.donated,
      notes: [
        ["Caught", `${k.total_collected.toLocaleString()}×${k.count ? ` · ${k.count} in your bag` : ""}`],
        ["Record", k.best_size_cm !== null ? `${k.best_size_cm} cm` : k.size_range ? `${k.size_range[0]}-${k.size_range[1]} cm` : "No size"],
        ["Where and when", `${k.clue} ${when}.`],
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
      text: found ? (fish ? `Bites ${fish.whenLabel ?? "any time"}.` : "In your collection.") : "Not found yet.", outNow: false, donated: false, notes: found ? notes : [["Found", "Not yet"]] };
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

  return <FlatPanel open={open} onClose={onClose} title="Collection" keys={keys} testId="collection-sheet" rail={rail}
    purse={<span className={s.summary}>{discovered}/{totalKinds} kinds discovered · {caught} caught</span>}>
    {note && <p className={s.note} role="status"><SignInText text={note} /></p>}
    {entry ? <Detail e={entry} list={entries} back={title} onPick={setPicked} />
      : <>
        <div className={s.head}>
          <h3 className={f.shelfTitle}>{title}</h3>
          <span className={s.count} data-done={got === of || undefined}>{got === of ? <Check size={14} strokeWidth={3} aria-label="Complete" /> : null}{got}/{of}</span>
          {!page && catalogGroup.group === "Fish" && <span className={s.filters} role="group" aria-label="Show">
            {([["all", "All"], ["river", "River"], ["sea", "Sea"], ["caught", "Discovered"]] as const).map(([k, label]) =>
              <GhostButton key={k} aria-pressed={fishFilter === k} data-on={fishFilter === k || undefined} onClick={() => setFishFilter(k)}>{label}</GhostButton>)}
          </span>}
        </div>
        {entries.length === 0 ? <Quiet>Nothing here yet.</Quiet>
          : <CardGrid min={150} phoneMin={104}>{entries.map(e => <ItemCard key={e.id} size="sm" arrow={false} picture={e.picture} px={40} name={e.name}
            line={e.found ? <>{e.rarity ? <i className={s.rarity} style={{ background: `var(--gui-rarity-${e.rarity})` }} aria-hidden /> : null}{e.rarity ? cap(e.rarity) : e.kind}</> : "Not found yet"}
            pill={e.donated ? <Landmark size={12} aria-label="On display at the museum" /> : null} tag={e.outNow ? "Out now" : null} cover={e.found ? null : "not-found"}
            onClick={() => { setPicked(e.id); AudioManager.playSFX("blip1"); }} label={e.found ? e.name : `Undiscovered · ${e.text}`} />)}</CardGrid>}
      </>}
  </FlatPanel>;
}

/** An entry on the white studio stage (a silhouette until found) with its field notes. */
function Detail({ e, list, back, onPick }: { e: Entry; list: Entry[]; back: string; onPick: (id: string | null) => void }) {
  const spec = useMemo(() => (e.found && e.key ? keyModel(e.key) : null), [e]);
  const i = list.indexOf(e), prev = list[(i - 1 + list.length) % list.length], next = list[(i + 1) % list.length];
  return <DetailView testId="collection-detail" onBack={() => onPick(null)} backLabel={back} hint={spec ? "Drag to turn" : null}
    stage={spec ? <ItemViewer key={e.id} spec={spec} picture={e.picture} name={e.name} className={STAGE.stage} pictureClassName={STAGE.picture} />
      : <div className={`${STAGE.stage} ${e.found ? "" : s.silhouette}`}><PixelImage src={e.picture} px={72} className={STAGE.picture} label={e.found ? e.name : "Undiscovered"} /></div>}
    steps={list.length > 1 ? { prev: { label: `Previous: ${prev.name}`, onClick: () => onPick(prev.id) }, next: { label: `Next: ${next.name}`, onClick: () => onPick(next.id) } } : null}
    info={<>
      <InfoHead kind={<span className={s.kind}>{e.kind}{e.rarity ? <RarityBadge rarity={e.rarity}>{RARITY_META[e.rarity as keyof typeof RARITY_META]?.label ?? e.rarity}</RarityBadge> : null}</span>}
        title={e.found ? e.name : "Undiscovered"} text={e.text} />
      {e.donated && <p className={s.museum}><Landmark size={14} aria-hidden /> On display at the museum</p>}
    </>}
    specs={e.notes} />;
}
