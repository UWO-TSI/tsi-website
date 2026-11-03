"use client";

/**
 * The sushi bar's menu (f-sushi phase B; David, 2026-10-28: "BAR MENU SHOULD BE PAPER MENU LIKE REAL RESTAURANCE ...
 * these food should have a detailed food model on the menu and you can pick it up first person and hover over dishes
 * show what they do"). Seated at the bar, Menu picks it up: the camera leans in and looks down (SushiBar's readingView,
 * on tsi:bar-menu) while a folded teahouse menu (David's references, specs/references/sushi-menu/) rises into your
 * hands and fills the view; it opens from its cover, and its panels turn. Each dish is a photo (its high-def model's icon
 * once made: DISH_ART; a marked stand-in until then) with its name, price and what it does beside it (round 4, David:
 * "simple photo of food and then price on the side with like stats"). Pick a dish, then order it: coins, or for the feast one of your own epic or legendary fish. The
 * server prices everything and rolls your casts with the meal's buff (lib/wallet/service.ts orderDish).
 * The back pages are the tasting book (David, 2026-11-01: "one per fish kinda thing and they can either turn into meal
 * that gets buff and a stamp or in the aquarium"; round 2: "perm small like 1% buff for fishing for new species and it
 * can unlcok dishes"; round 3: "key fish, tank is the route for milestones and unlocks and cooking is solely for
 * bonuses"): bring Bancha a fish not yet in your book, cook it (his nigiri: a fee that grows with the species cooked, its
 * stamp, and a little more luck for good, nothing else) or give it to HQ's tank (the book's milestones, and a key fish
 * teaches him its dish); a page per water, a slot per species (lib/wallet/service.ts serveFish). The dishes are ordered
 * off the book's second page for coins and their ingredients (orderDish). Every meal is named in the rod's six stats.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, Clover, Fish, Soup, X } from "lucide-react";
import { DISH_ART, mealOf, SUSHI_MENU, TASTING, type BookDish, type Dish, type MealBuff } from "@/lib/wallet/catalogue";
import { STAT_KEYS } from "@/lib/game/rods";
import type { ActiveBuff, TastingSlot } from "@/lib/wallet/store";
import type { SellEntry, SushiView, TastingView } from "@/lib/wallet/service";
import { bookLuck, tastingFee, tastingPages, tastingWater, type TastingWater } from "@/lib/wallet/rules";
import { ROSTER } from "@/lib/collections/roster";
import type { WaterType } from "@/lib/game/fishingSpots";
import { newKey } from "@/lib/apiClient";
import { iconUrl } from "@/lib/icons/keys";
import { usePresence, useWorldDialog } from "@/lib/game/useWorldDialog";
import { httpEconomyTransport, type EconomyTransport } from "@/lib/wallet/transport";
import { CurrencyIcon } from "@/components/economy/Amount";
import { mealRows } from "@/components/economy/statIcons";
import PixelImage from "@/components/economy/PixelImage";
import { errText } from "@/components/economy/EconomySheets";
import { BookMarks, BookPage, BookSlot, CoverTitle, FoldedMenu, Hanko, InkArt, InkDefs, MenuDish, PanelSection, Thumb, useInkId, type DishStat, type FoldedMenuHandle } from "@/components/gui/flat";
import { toast } from "@/components/gui";
import m from "./menu.module.css";

/** "Luck +10%, Bite window +10%, 45 min": what a meal does, in the rod's words. */
export function mealText(b: MealBuff, minutes?: number) {
  const text = mealRows(b).map(r => `${r.label} ${r.value}`).join(", ") || "A warm meal";
  return minutes ? `${text}, ${minutes} min` : text;
}
const minutesLeft = (b: ActiveBuff) => Math.max(1, Math.round((new Date(b.until).getTime() - Date.now()) / 60_000));
const FEAST_RARITIES = ["epic", "legendary"];

/** A dish's picture on its plate: the icon of its high-def model once made, else its stand-in. */
function DishPicture({ id }: { id: string }) {
  const art = DISH_ART[id];
  return <PixelImage src={iconUrl(art ? (art.ready ? art.icon : art.standIn) : "lounge-tea")} px={64} />;
}

/** The cover's one line (round 4, David: "say something like poetic but not claude"; options for him on the review page). */
export const COVER_LINE = "Bring your best fish. Bancha knows what to do with it.";

/** Each stat's most on any dish, for the dots. */
const MOST = Object.fromEntries(STAT_KEYS.map(k => [k, Math.max(...[...SUSHI_MENU, ...TASTING.dishes].map(d => d.buff[k] ?? 0))]));
/** What a meal does, a row a stat beside its photo: the rod's stats it raises (as dots of the menu's most), how long. */
export function dishStats(b: MealBuff): DishStat[] {
  return [
    ...mealRows(b).map(r => ({ icon: r.icon, label: r.label, value: r.value, level: Math.max(1, Math.round((5 * (b[r.key] ?? 0)) / MOST[r.key])) })),
    { icon: <Clock />, label: "Lasts", value: `${b.minutes} min` },
  ];
}

/** The book's pages, as the menu shows them: the waters you fish first; a water not open yet says when it opens. */
const PAGES = tastingPages();
const WATER_TITLE: Record<TastingWater, string> = { river: "River", sea: "Sea", pond: "Pond", cliff_pool: "Cliff pools" };
const NAME = new Map(ROSTER.map(s => [s.key, s.name]));
/** The book's dishes, two to a panel (a phone's narrow panel holds two). */
const DISH_PANELS = Array.from({ length: Math.ceil(TASTING.dishes.length / 2) }, (_, i) => TASTING.dishes.slice(2 * i, 2 * i + 2));
/** The panels before the water pages: the menu's four, the book's own, its dishes (rounded up to a whole spread). */
const BEFORE_PAGES = 2 * Math.ceil((5 + DISH_PANELS.length) / 2);
/** The panel a water's page is, so its spread: 0 the cover, one a pair. */
const pageSpread = (water: TastingWater) => 1 + Math.floor((BEFORE_PAGES + PAGES.findIndex(p => p.water === water)) / 2);
/** "+1%", "+0.5%": a share of luck as the book words it. */
const pct = (v: number) => `+${Math.round(v * 1000) / 10}%`;
const COUNT_WORD: Record<number, string> = { 10: "Ten", 25: "Twenty-five" };
/** A milestone the server paid (tasting_serve's `marks`: "count:10", "water:river") as the reward card's gift. */
function markGift(mark: string) {
  const [kind, v] = mark.split(":"), count = kind === "count";
  const coins = count ? TASTING.marks.find(m => m.at === Number(v))?.coins ?? 0 : TASTING.full;
  return { key: "coin", name: `${coins} coins`, title: count ? `${COUNT_WORD[Number(v)] ?? v} in the tank` : `The ${WATER_TITLE[v as TastingWater]?.toLowerCase() ?? v}, all in the tank`,
    note: count ? "Bancha keeps count. He nods, and slides the coins across." : "Every fish from that water, swimming at HQ. Bancha is impressed." };
}

/** Tell the bar the menu is up or down: the seated camera leans in to read it (SushiBar). */
const lift = (up: boolean) => window.dispatchEvent(new CustomEvent("tsi:bar-menu", { detail: up }));

/**
 * The menu picked up at the bar: a folded teahouse menu in your hands (David's references, 2026-10-28): its cover first
 * (the name top to bottom in ink, the hanko, a pagoda and a plum branch in mist), then two spreads you turn: the pot and
 * the counter's nigiri and rolls, then the chef's and the feast you bring the fish for. Each dish on its tray.
 */
export function MenuPickup({ open, onClose, waters = ["sea", "river"], transport = httpEconomyTransport }: { open: boolean; onClose: () => void; waters?: readonly WaterType[]; transport?: EconomyTransport }) {
  const state = usePresence(open, 380);
  const panel = useWorldDialog<HTMLDivElement>(open, onClose, "m");
  const [data, setData] = useState<[SushiView, SellEntry[], TastingView | null] | null>(null), [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null), [busy, setBusy] = useState(false);
  // The tasting book: the fish picked at the counter, the slot whose stamp just landed, and the page to turn to.
  const [chosen, setChosen] = useState<string | null>(null), [fresh, setFresh] = useState<string | null>(null), folded = useRef<FoldedMenuHandle>(null);
  const ink = useInkId();
  const load = useCallback(() => Promise.all([transport.sushi(), transport.sellable(), transport.tasting().catch(() => null)]).then(setData, e => setError(errText(e))), [transport]);
  useEffect(() => {
    if (!open) return;
    lift(true);
    void load();
    setPicked(null);
    setChosen(null);
    setFresh(null);
    return () => { lift(false); };
  }, [open, load]);
  if (!state) return null;
  const menu = data?.[0].menu ?? SUSHI_MENU, buff = data?.[0].buff ?? null, ate = mealOf(buff?.source);
  const rare = (data?.[1] ?? []).filter(e => (e.category === "fish" || e.category === "sea") && FEAST_RARITIES.includes(e.rarity) && !e.locked);
  const book = new Map((data?.[2]?.book ?? []).map(s => [s.species_key, s.way]));
  // Only a fish whose slot is empty goes to the counter: a slot fills once.
  const tastable = (data?.[1] ?? []).filter(e => tastingWater(e.item_key) && !book.has(e.item_key) && !e.locked && e.count > 0);
  const cooked = [...book.values()].filter(w => w === "cooked").length, tanked = book.size - cooked, fee = tastingFee(cooked);
  const serve = async (fish: SellEntry, way: "cook" | "aquarium") => {
    setBusy(true);
    try {
      const r = await transport.serve(fish.item_key, way, newKey());
      const taught = way === "aquarium" && TASTING.dishes.find(d => d.unlock === fish.item_key);
      toast(way === "cook" ? `${fish.name}, stamped. Luck ${pct(bookLuck(cooked + 1))} for good.` : `Your ${fish.name.toLowerCase()} swims in HQ's tank now${taught ? `, and Bancha learnt his ${taught.name.toLowerCase()}` : ""}.`, iconUrl(fish.item_key));
      r.marks.forEach(mk => window.dispatchEvent(new CustomEvent("tsi:gift", { detail: markGift(mk) })));
      // The slot fills here at once (the server has said so), the page turns to it and the stamp presses down.
      const slot: TastingSlot = { species_key: fish.item_key, way: way === "cook" ? "cooked" : "aquarium" };
      setData(cur => cur && [cur[0], cur[1].map(e => (e.item_key === fish.item_key ? { ...e, count: r.remaining } : e)), cur[2] && { ...cur[2], book: [...cur[2].book, slot] }]);
      setChosen(null);
      setPicked(null);
      setFresh(fish.item_key);
      folded.current?.turn(pageSpread(tastingWater(fish.item_key)!));
      void load();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };
  const order = async (d: Dish, fish?: string) => {
    setBusy(true);
    try {
      await transport.order(d.id, newKey(), fish);
      toast(`${d.name}: ${mealText(d.buff, d.buff.minutes).toLowerCase()}`, iconUrl(DISH_ART[d.id]?.standIn ?? "lounge-tea"));
      onClose();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };
  const dish = (id: string) => {
    const d = menu.find(x => x.id === id);
    if (!d) return null;
    const feast = d.price === null, isOpen = picked === d.id;
    return <MenuDish key={d.id} open={isOpen} picture={<DishPicture id={d.id} />} standIn={!DISH_ART[d.id]?.ready} name={d.name}
      stats={dishStats(d.buff)} note={d.blurb}
      price={feast ? <><Fish size={14} aria-hidden />Your fish</> : <>{d.price}<CurrencyIcon size={13} /></>}
      onPick={() => setPicked(isOpen ? null : d.id)}>
      {!feast ? <button type="button" className={m.order} disabled={busy} onClick={() => void order(d)}>Order<span>{d.price}<CurrencyIcon size={12} /></span></button>
        : rare.length === 0 ? <span className={m.quiet}>Bring an epic or legendary fish.</span>
        : rare.map(f => <Thumb key={f.item_key} picture={iconUrl(f.item_key)} rarity={f.rarity} size={46} count={f.count} label={`Cook my ${f.name}`} onClick={busy ? undefined : () => void order(d, f.item_key)} />)}
    </MenuDish>;
  };
  const T = TASTING.nigiri, chosenFish = tastable.find(e => e.item_key === chosen) ?? null;
  const step = bookLuck(cooked + 1) - bookLuck(cooked), teaches = chosenFish && TASTING.dishes.find(d => d.unlock === chosenFish.item_key);
  const nigiriStats: DishStat[] = [
    ...(step > 0 ? [{ icon: <Clover />, label: "Luck", value: pct(step) }] : []),
    { icon: <Clock />, label: "Lasts", value: "For good" },
  ];
  const tasting = <MenuDish key="tasting" open={picked === T.id} picture={<DishPicture id={T.id} />} standIn={!DISH_ART[T.id]?.ready} name={T.name}
    stats={nigiriStats} note={T.blurb} price={<>{fee}<CurrencyIcon size={13} /></>} onPick={() => { setPicked(picked === T.id ? null : T.id); setChosen(null); }}>
    {tastable.length === 0 ? <span className={m.quiet}>Bring a fish that isn&apos;t in your book yet.</span> : <>
      <div className={m.fishRow}>{tastable.map(f => <Thumb key={f.item_key} picture={iconUrl(f.item_key)} rarity={f.rarity} size={42} count={f.count} label={f.name}
        selected={chosen === f.item_key} onClick={busy ? undefined : () => setChosen(chosen === f.item_key ? null : f.item_key)} />)}</div>
      {chosenFish ? <div className={m.choice} data-testid="tasting-choice">
        <span className={m.quiet}>{teaches ? `${chosenFish.name}: cook it for luck, or in the tank it teaches Bancha his ${teaches.name.toLowerCase()}.` : `${chosenFish.name}: cook it for luck, or give it to the tank?`}</span>
        <button type="button" className={m.order} disabled={busy} onClick={() => void serve(chosenFish, "cook")}>Cook it<span>{fee}<CurrencyIcon size={12} /></span></button>
        <button type="button" className={m.order} data-quiet="" disabled={busy} onClick={() => void serve(chosenFish, "aquarium")}>For the aquarium</button>
      </div> : null}
    </>}
  </MenuDish>;
  // The book's dishes: learnt with their fish's stamp, then ordered for coins and what's in your bag.
  const inBag = new Map((data?.[1] ?? []).filter(e => !e.locked).map(e => [e.item_key, e.count]));
  const bookDish = (d: BookDish) => {
    const learnt = book.get(d.unlock) === "aquarium", ready = d.ingredients.every(([k, n]) => (inBag.get(k) ?? 0) >= n), isOpen = picked === d.id;
    return <MenuDish key={d.id} open={isOpen} picture={<DishPicture id={d.id} />} standIn={!DISH_ART[d.id]?.ready} name={d.name}
      stats={dishStats(d.buff)} note={learnt ? d.blurb : book.get(d.unlock) === "cooked" ? `Cooked: only a ${NAME.get(d.unlock) ?? d.unlock} in the tank teaches it.` : `Give a ${NAME.get(d.unlock) ?? d.unlock} to the tank and Bancha learns it.`}
      price={<>{d.price}<CurrencyIcon size={13} /></>} onPick={() => setPicked(isOpen ? null : d.id)}>
      <div className={m.fishRow}>{d.ingredients.map(([k, n]) => <Thumb key={k} picture={iconUrl(k)} size={42} count={n} dim={(inBag.get(k) ?? 0) < n}
        label={`${n} ${NAME.get(k) ?? k}, you have ${inBag.get(k) ?? 0}`} />)}</div>
      {!learnt ? <span className={m.quiet}>Not learnt yet.</span>
        : <button type="button" className={m.order} disabled={busy || !ready} onClick={() => void order(d)}>{ready ? "Order" : "Bring what it takes"}<span>{d.price}<CurrencyIcon size={12} /></span></button>}
    </MenuDish>;
  };
  // Each page its own wash of ink at the foot, as the menu's panels have.
  const PAGE_ART = [<InkArt key="a" kind="bamboo" filter={ink} className={m.bamboo} />, <InkArt key="b" kind="mist" filter={ink} fade="none" className={m.mistLow} />,
    <InkArt key="c" kind="plum" filter={ink} fade="left" className={m.plumCorner} />, <InkArt key="d" kind="pagoda" filter={ink} className={m.pagodaLow} />];
  const pages = PAGES.map(({ water, species }, i) => {
    const filled = species.filter(k => book.has(k)).length, cookedHere = species.some(k => book.get(k) === "cooked");
    const opensLater = water === "cliff_pool" ? "Opens later" : water === "pond" && !waters.includes("pond") ? "Opens with the mountain" : null;
    // A water pays when every fish of it is in the tank: once one is cooked, the page just fills.
    const note = opensLater ?? (filled === species.length ? "Full" : cookedHere ? null : <>All in the tank: {TASTING.full}<CurrencyIcon size={11} /></>);
    return <>
      <BookPage title={WATER_TITLE[water]} filled={filled} total={species.length} note={note}>
        {species.map(k => <BookSlot key={k} filter={ink} name={NAME.get(k) ?? k} state={book.get(k) ?? "empty"} fresh={fresh === k} picture={<PixelImage src={iconUrl(k)} px={36} />} />)}
      </BookPage>
      {PAGE_ART[i]}
    </>;
  });
  const cover = <>
    <CoverTitle filter={ink} title="Bancha" kind="Sushi bar" line={COVER_LINE} />
    <div className={m.coverFoot}>
      <InkArt kind="pagoda" filter={ink} className={m.coverPagoda} />
      <InkArt kind="plum" filter={ink} fade="none" className={m.coverPlum} />
      <InkArt kind="mist" filter={ink} fade="none" className={m.coverMist} />
    </div>
  </>;
  const panels = [
    <>
      <p className={m.welcome}>Each meal helps your fishing for a while.<br />A new meal replaces the last.</p>
      <PanelSection title="From the pot">{dish("miso_soup")}</PanelSection>
      {buff && ate ? <p className={m.meal}><Soup size={13} aria-hidden />{mealText(ate.buff)} · {minutesLeft(buff)} min left</p> : null}
      <InkArt kind="bamboo" filter={ink} className={m.bamboo} />
    </>,
    <>
      <PanelSection title="Nigiri and rolls">{dish("salmon_nigiri")}{dish("tuna_roll")}</PanelSection>
      <InkArt kind="mist" filter={ink} fade="none" className={m.mistLow} />
    </>,
    <>
      <PanelSection title="The chef's">{dish("omakase")}{dish("feast")}</PanelSection>
      <InkArt kind="plum" filter={ink} fade="left" className={m.plumCorner} />
    </>,
    <>
      <PanelSection title="Bring your own">{tasting}</PanelSection>
      <Hanko filter={ink} size={24} className={m.backSeal} />
      <InkArt kind="pagoda" filter={ink} className={m.pagodaLow} />
    </>,
    <>
      <PanelSection title="The book">
        <p className={m.welcome}>A fish new to your book: cook it for luck,<br />or give it to the tank for the marks and a key fish&apos;s dish.</p>
        <p className={m.meal} data-testid="book-luck"><Clover size={13} aria-hidden />{cooked ? `${cooked} cooked: luck ${pct(bookLuck(cooked))} for good` : "Nothing cooked yet"}</p>
        <p className={m.meal}><Fish size={13} aria-hidden />{tanked} in the tank</p>
        <BookMarks marks={TASTING.marks.map(mk => ({ at: mk.at, done: tanked >= mk.at, reward: <>{mk.coins}<CurrencyIcon size={11} /></> }))} />
      </PanelSection>
      <InkArt kind="mist" filter={ink} fade="none" className={m.mistLow} />
    </>,
    ...DISH_PANELS.map((dishes, i) => <>
      <PanelSection title="From the book">{dishes.map(bookDish)}</PanelSection>
      {i === DISH_PANELS.length - 1 ? <InkArt kind="bamboo" filter={ink} className={m.bamboo} /> : null}
    </>),
    // An odd count leaves a panel: the plum alone, so the water pages start on a left page.
    ...((5 + DISH_PANELS.length) % 2 ? [<><InkArt kind="plum" filter={ink} fade="none" className={m.plumCorner} /></>] : []),
    ...pages,
  ];
  return <div className={m.layer} data-state={state}>
    <div className={m.vignette} onClick={onClose} aria-hidden />
    <div ref={panel} role="dialog" aria-modal aria-label="Menu" tabIndex={-1} data-gui-dialog data-gui-overlay className={m.hands} data-testid="sushi-menu">
      <InkDefs id={ink} />
      {error ? <p className={m.error} role="status">{error}</p> : null}
      <FoldedMenu cover={cover} panels={panels} label="Bancha's menu" handle={folded} onTurn={() => setPicked(null)} />
      <button type="button" className={m.down} onClick={onClose} aria-label="Put the menu down"><X size={16} aria-hidden /></button>
    </div>
  </div>;
}
