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
 * The tasting book is in it too (David, 2026-11-01: "one per fish kinda thing"; round 2: "perm small like 1% buff for
 * fishing for new species and it can unlcok dishes"; round 5: "the first page which is offering new fish theres a button
 * that gives them new fish from your inv, and the pages after are temp boosts"; round 6: "make it obvious it s a
 * collection that give [permanent] boosts", "display all fish thats already given, allow you to open bag to give fish in
 * inv but grey out ones you already given", "the pages need to be reorganized in a userfriendly intuitive way"). The menu
 * in four parts, named under it: the collection (your luck for good, Open your bag, every fish given and what it gave),
 * the dishes your key fish taught Bancha (ordered for coins and their ingredients, orderDish), the house's meals, and
 * every fish, a page per water (lib/wallet/service.ts serveFish). Every meal is named in the rod's six stats.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Backpack, Check, Clock, Clover, Coins, Fish, Lock, Soup, X } from "lucide-react";
import { DISH_ART, mealOf, SUSHI_MENU, TASTING, type BookDish, type Dish, type MealBuff } from "@/lib/wallet/catalogue";
import { STAT_KEYS } from "@/lib/game/rods";
import type { ActiveBuff } from "@/lib/wallet/store";
import type { SellEntry, SushiView, TastingView } from "@/lib/wallet/service";
import { bookLuck, tastingFee, tastingPages, tastingWater, type TastingWater } from "@/lib/wallet/rules";
import { ROSTER } from "@/lib/collections/roster";
import type { WaterType } from "@/lib/game/fishingSpots";
import { newKey } from "@/lib/apiClient";
import { iconUrl } from "@/lib/icons/keys";
import { usePresence, useWorldDialog } from "@/lib/game/useWorldDialog";
import { httpEconomyTransport, type EconomyTransport } from "@/lib/wallet/transport";
import { useMoveKeys } from "@/lib/game/movement/keys";
import { DEFAULT_PITCH, lookOrbit, orbit } from "@/lib/game/orbitCamera";
import { CurrencyIcon } from "@/components/economy/Amount";
import { mealRows } from "@/components/economy/statIcons";
import PixelImage from "@/components/economy/PixelImage";
import { errText } from "@/components/economy/EconomySheets";
import { BookPage, BookSlot, BoostTrack, CardGrid, CoverTitle, DarkButton, FlatDialog, FlatPanel, FoldedMenu, GivenFish, Hanko, InkArt, InkDefs, ItemCard, MenuDish, PanelSection, PaperRow, Quiet, SidePanel, spreadOf, StatusLine, Thumb, useInkId, WithSide, type DishStat, type FoldedMenuHandle } from "@/components/gui/flat";
import { toast } from "@/components/gui";
import type { Rarity } from "@/lib/rarity";
import { HQ_LINES } from "@/lib/game/hqLayout";
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
const COVER_LINE = "Bring your best fish. Bancha knows what to do with it.";

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
/** "+1%", "+0.5%": a share of luck as the book words it. */
const pct = (v: number) => `+${Math.round(v * 1000) / 10}%`;
/** How many fish the luck takes to its cap: the collection's track. */
const LUCK_SLOTS = Math.round(TASTING.luck.cap / TASTING.luck.each);
const teachOf = (key: string) => TASTING.dishes.find(d => d.unlock === key);
/** What the fish given `at` (0 the first) added to your luck: +1% to the cap, then nothing. */
const gaveLuck = (at: number) => bookLuck(at + 1) - bookLuck(at);
/** The dishes your fish teach, the ones Bancha has learnt first, two to a panel (a phone's narrow panel holds two). */
const dishOrder = (book: ReadonlySet<string>) => [...TASTING.dishes].sort((a, b) => Number(book.has(b.unlock)) - Number(book.has(a.unlock)));
/**
 * The menu's parts in order (round 6, David: "the pages need to be reorganized in a userfriendly intuitive way"), each
 * from a left page (a part with an odd count of panels ends on a page of ink art): the collection (2 panels), the dishes
 * your fish teach (their contents, then two a panel), the house's meals (4), every fish by water (4).
 */
const even = (n: number) => n + (n % 2);
const DISH_PANELS = Math.ceil(TASTING.dishes.length / 2);
const PART = { collection: 0, dishes: 2, house: 2 + even(1 + DISH_PANELS), book: 2 + even(1 + DISH_PANELS) + 4 };
const CHAPTERS = [{ label: "Collection", panel: PART.collection }, { label: "Dishes", panel: PART.dishes }, { label: "Menu", panel: PART.house }, { label: "All fish", panel: PART.book }];
const dishSpread = (dish: BookDish, book: ReadonlySet<string>) => spreadOf(PART.dishes + 1 + Math.floor(dishOrder(book).indexOf(dish) / 2));
const COUNT_WORD: Record<number, string> = { 10: "Ten", 25: "Twenty-five" };
/** A milestone the server paid (tasting_serve's `marks`: "count:10", "water:river") as the reward card's gift. */
function markGift(mark: string) {
  const [kind, v] = mark.split(":"), count = kind === "count";
  const coins = count ? TASTING.marks.find(m => m.at === Number(v))?.coins ?? 0 : TASTING.full;
  return { key: "coin", name: `${coins} coins`, title: count ? `${COUNT_WORD[Number(v)] ?? v} fish given` : `The ${WATER_TITLE[v as TastingWater]?.toLowerCase() ?? v}, a full page`,
    note: count ? "Bancha keeps count. He nods, and slides the coins across." : "Every fish from that water in your book. Bancha is impressed." };
}

/** The menu's cover (also the counter's menu model's, art/buildings/build_sushi_menu.py, and the showroom's): the name, the
 * line, and a pagoda far off in mist with a plum branch reaching in over it. */
export function MenuCover({ ink }: { ink: string }) {
  return <>
    <CoverTitle filter={ink} title="Bancha" kind="Sushi bar" line={COVER_LINE} />
    <div className={m.coverFoot}>
      <InkArt kind="pagoda" filter={ink} className={m.coverPagoda} />
      <InkArt kind="plum" filter={ink} fade="none" className={m.coverPlum} />
      <InkArt kind="mist" filter={ink} fade="none" className={m.coverMist} />
    </div>
  </>;
}

/** Tell the bar the menu is up or down: the seated camera leans in to read it (SushiBar). */
const lift = (up: boolean) => window.dispatchEvent(new CustomEvent("tsi:bar-menu", { detail: up }));

/**
 * The menu picked up at the bar: a folded teahouse menu in your hands (David's references, 2026-10-28): its cover first
 * (the name in ink, the hanko, a pagoda and a plum branch in mist), then its parts, named under it (CHAPTERS). The
 * collection's Open your bag opens your bag over the menu (GiveSheet) to give Bancha a fish.
 */
export function MenuPickup({ open, onClose, waters = ["sea", "river"], transport = httpEconomyTransport }: { open: boolean; onClose: () => void; waters?: readonly WaterType[]; transport?: EconomyTransport }) {
  const state = usePresence(open, 380);
  // Put down (round 4): Esc, M, a tap outside, looking back up (the arrow up, or the mouse up past it), or moving, which gets you up too.
  const panel = useWorldDialog<HTMLDivElement>(open, onClose, "m");
  const moves = useMoveKeys();
  // Your bag, opened from the collection over the menu.
  const [bag, setBag] = useState(false);
  useEffect(() => {
    if (!open || bag) return;
    const walk = [moves.forward, moves.back, moves.left, moves.right].map(k => k.toLowerCase());
    const key = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (walk.includes(e.key.toLowerCase())) { onClose(); window.dispatchEvent(new Event("tsi:stand")); }
      // The arrow up looks back up from the counter (the seated view's middle), which puts the menu down.
      if (e.key === "ArrowUp") { orbit.target.pitch = Math.min(orbit.target.pitch, DEFAULT_PITCH); onClose(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, bag, onClose, moves]);
  const [data, setData] = useState<[SushiView, SellEntry[], TastingView | null] | null>(null), [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null), [busy, setBusy] = useState(false);
  // The fish whose stamp just landed in the collection, and the page to turn to.
  const [fresh, setFresh] = useState<string | null>(null), folded = useRef<FoldedMenuHandle>(null);
  const ink = useInkId();
  const load = useCallback(() => Promise.all([transport.sushi(), transport.sellable(), transport.tasting().catch(() => null)]).then(setData, e => setError(errText(e))), [transport]);
  useEffect(() => {
    if (!open) return;
    lift(true);
    void load();
    setPicked(null);
    setFresh(null);
    setBag(false);
    return () => { lift(false); };
  }, [open, load]);
  if (!state) return null;
  const menu = data?.[0].menu ?? SUSHI_MENU, buff = data?.[0].buff ?? null, ate = mealOf(buff?.source);
  const rare = (data?.[1] ?? []).filter(e => (e.category === "fish" || e.category === "sea") && FEAST_RARITIES.includes(e.rarity) && !e.locked);
  // The collection: every fish given, in the order given (a slot fills once).
  const given = (data?.[2]?.book ?? []).map(s => s.species_key), book = new Set(given), fee = tastingFee(given.length);
  const fish = (data?.[1] ?? []).filter(e => tastingWater(e.item_key) && !e.locked && e.count > 0);
  const cook = async (f: SellEntry) => {
    setBusy(true);
    try {
      const r = await transport.serve(f.item_key, "cook", newKey()), taught = teachOf(f.item_key);
      toast(`${f.name}, stamped. Luck ${pct(bookLuck(given.length + 1))} for good${taught ? `, and Bancha learnt his ${taught.name.toLowerCase()}` : ""}.`, iconUrl(f.item_key));
      r.marks.forEach(mk => window.dispatchEvent(new CustomEvent("tsi:gift", { detail: markGift(mk) })));
      // The stamp lands here at once (the server has said so): the bag closes onto the collection and it presses down.
      setData(cur => cur && [cur[0], cur[1].map(e => (e.item_key === f.item_key ? { ...e, count: r.remaining } : e)), cur[2] && { ...cur[2], book: [...cur[2].book, { species_key: f.item_key }] }]);
      setBag(false);
      setFresh(f.item_key);
      // A key fish turns to the dish it taught, which opens with its order ready (after the turn, which shuts dishes).
      if (taught) folded.current?.turn(dishSpread(taught, new Set([...book, f.item_key])));
      setPicked(taught?.id ?? null);
      void load();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };
  const order = async (d: Dish, fishKey?: string) => {
    setBusy(true);
    try {
      await transport.order(d.id, newKey(), fishKey);
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
  // The dishes your fish teach: learnt once their key fish is given, then ordered for coins and what's in your bag.
  const inBag = new Map((data?.[1] ?? []).filter(e => !e.locked).map(e => [e.item_key, e.count]));
  const giveHint = (d: BookDish) => `Give Bancha a ${(NAME.get(d.unlock) ?? d.unlock).toLowerCase()} and he learns it.`;
  const bookDish = (d: BookDish) => {
    const learnt = book.has(d.unlock), ready = d.ingredients.every(([k, n]) => (inBag.get(k) ?? 0) >= n), isOpen = picked === d.id;
    return <MenuDish key={d.id} open={isOpen} picture={<DishPicture id={d.id} />} standIn={!DISH_ART[d.id]?.ready} name={d.name}
      stats={dishStats(d.buff)} note={learnt ? d.blurb : giveHint(d)}
      price={<>{d.price}<CurrencyIcon size={13} /></>} onPick={() => setPicked(isOpen ? null : d.id)}>
      <div className={m.fishRow}>{d.ingredients.map(([k, n]) => <Thumb key={k} picture={iconUrl(k)} size={42} count={n} dim={(inBag.get(k) ?? 0) < n}
        label={`${n} ${NAME.get(k) ?? k}, you have ${inBag.get(k) ?? 0}`} />)}</div>
      {!learnt ? <span className={m.quiet}>{giveHint(d)}</span>
        : <button type="button" className={m.order} disabled={busy || !ready} onClick={() => void order(d)}>{ready ? "Order" : "Bring what it takes"}<span>{d.price}<CurrencyIcon size={12} /></span></button>}
    </MenuDish>;
  };
  const dishes = dishOrder(book), next = TASTING.marks.find(mk => mk.at > given.length);
  const ART = {
    bamboo: <InkArt kind="bamboo" filter={ink} className={m.bamboo} />, mist: <InkArt kind="mist" filter={ink} fade="none" className={m.mistLow} />,
    plum: <InkArt kind="plum" filter={ink} fade="left" className={m.plumCorner} />, pagoda: <InkArt kind="pagoda" filter={ink} className={m.pagodaLow} />,
  };
  const collection: ReactNode[] = [
    <>
      <PanelSection title="Collection">
        <p className={m.welcome}>Every fish you give Bancha stays in your book and makes your fishing luckier, for good.</p>
        <BoostTrack filter={ink} icon={<Clover />} value={pct(bookLuck(given.length))} label="luck, for good" filled={Math.min(given.length, LUCK_SLOTS)} total={LUCK_SLOTS}
          note={`${pct(TASTING.luck.each)} a new fish, up to ${pct(TASTING.luck.cap)}. A key fish teaches him a dish too.`} />
        <span><button type="button" className={m.order} onClick={() => setBag(true)} disabled={!data} data-testid="open-bag"><Backpack size={15} aria-hidden />Open your bag</button></span>
        {next ? <p className={m.meal}><Coins size={13} aria-hidden />At {next.at} fish given, Bancha pays {next.coins}<CurrencyIcon size={11} /></p> : null}
      </PanelSection>
      <Hanko filter={ink} size={24} className={m.backSeal} />
    </>,
    <>
      <PanelSection title="Given">
        <p className={m.welcome}>{given.length ? `${given.length} fish, the newest first` : "Nothing given yet. Open your bag and give Bancha a fish."}</p>
        <div className={m.given} data-testid="given">{given.map((k, i) => {
          const t = teachOf(k);
          return <GivenFish key={k} filter={ink} picture={<PixelImage src={iconUrl(k)} px={40} />} name={NAME.get(k) ?? k} fresh={fresh === k}
            gave={gaveLuck(i) > 0 ? <><Clover size={10} aria-hidden /> Luck {pct(gaveLuck(i))}</> : "Luck full"} extra={t ? t.name : undefined} />;
        }).reverse()}</div>
      </PanelSection>
      {ART.mist}
    </>,
  ];
  const dishPart: ReactNode[] = [
    <>
      <PanelSection title="Your dishes">
        <p className={`${m.welcome} ${m.wordy}`}>Give Bancha a key fish and he learns its dish. Each one helps your fishing for a while.</p>
        <div className={m.rows}>{dishes.map(d => {
          const learnt = book.has(d.unlock);
          return <PaperRow key={d.id} art={<BookSlot filter={ink} name={NAME.get(d.unlock) ?? d.unlock} state={learnt ? "given" : "empty"} picture={<PixelImage src={iconUrl(d.unlock)} px={30} />} />}
            title={d.name} detail={learnt ? `From your ${(NAME.get(d.unlock) ?? d.unlock).toLowerCase()}` : `Give a ${(NAME.get(d.unlock) ?? d.unlock).toLowerCase()}`}
            end={learnt ? <Check size={15} aria-label="Learnt" /> : <Lock size={13} aria-label="Not yet" />} onClick={() => folded.current?.turn(dishSpread(d, book))} />;
        })}</div>
      </PanelSection>
      {ART.bamboo}
    </>,
    ...Array.from({ length: DISH_PANELS }, (_, i) => <>
      <PanelSection title="Your dishes">{dishes.slice(2 * i, 2 * i + 2).map(bookDish)}</PanelSection>
      {[ART.plum, ART.mist][i % 2]}
    </>),
  ];
  const house: ReactNode[] = [
    <>
      <p className={m.welcome}>Each meal helps your fishing for a while.<br />A new meal replaces the last.</p>
      <PanelSection title="From the pot">{dish("miso_soup")}</PanelSection>
      {buff && ate ? <p className={m.meal}><Soup size={13} aria-hidden />{mealText(ate.buff)} · {minutesLeft(buff)} min left</p> : null}
      {ART.bamboo}
    </>,
    <><PanelSection title="Nigiri and rolls">{dish("salmon_nigiri")}{dish("tuna_roll")}</PanelSection>{ART.mist}</>,
    <><PanelSection title="The chef's">{dish("omakase")}</PanelSection>{ART.plum}</>,
    <><PanelSection title="Your catch">{dish("feast")}</PanelSection>{ART.pagoda}</>,
  ];
  const PAGE_ART = [ART.bamboo, ART.mist, ART.plum, ART.pagoda];
  const pages = PAGES.map(({ water, species }, i) => {
    const filled = species.filter(k => book.has(k)).length;
    const opensLater = water === "cliff_pool" ? "Opens later" : water === "pond" && !waters.includes("pond") ? "Opens with the mountain" : null;
    // A water pays when its page fills (round 4 pick).
    const note = opensLater ?? (filled === species.length ? "Full" : <>A full page: {TASTING.full}<CurrencyIcon size={11} /></>);
    return <>
      <BookPage title={WATER_TITLE[water]} filled={filled} total={species.length} note={note}>
        {species.map(k => <BookSlot key={k} filter={ink} name={NAME.get(k) ?? k} state={book.has(k) ? "given" : "empty"} fresh={fresh === k} picture={<PixelImage src={iconUrl(k)} px={36} />} />)}
      </BookPage>
      {PAGE_ART[i]}
    </>;
  });
  // Each part from a left page: an odd part ends on a page of ink art.
  const panels = [collection, dishPart, house, pages].flatMap(part => (part.length % 2 ? [...part, ART.pagoda] : part));
  return <>
    <div className={m.layer} data-state={state}>
      {/* Round the menu the mouse still tilts the seated view: back up to the middle puts it down (DefaultIslandWorld, tsi:bar-look). */}
      <div className={m.vignette} onClick={onClose} onPointerMove={e => { if (e.pointerType === "mouse") lookOrbit(0, e.movementY); }} aria-hidden />
      <div ref={panel} role="dialog" aria-modal aria-label="Menu" tabIndex={-1} data-gui-dialog data-gui-overlay className={m.hands} data-testid="sushi-menu">
        <InkDefs id={ink} />
        {error ? <p className={m.error} role="status">{error}</p> : null}
        <FoldedMenu cover={<MenuCover ink={ink} />} panels={panels} label="Bancha's menu" handle={folded} chapters={CHAPTERS} onTurn={() => setPicked(null)} />
        <button type="button" className={m.down} onClick={onClose} aria-label="Put the menu down"><X size={16} aria-hidden /></button>
      </div>
    </div>
    <GiveSheet open={open && bag} onClose={() => setBag(false)} fish={fish} book={book} fee={fee} busy={busy} onGive={f => void cook(f)} />
  </>;
}

/**
 * Your bag, opened from the menu's collection (round 6, David: "allow you to open bag to give fish in inv but grey out
 * ones you already given"): the flat kit's panel over the menu, your fish as cards, the ones not in your collection
 * first; a fish already given is greyed out. Pick one and the side says what it gives (luck for good, a dish for a key
 * fish), what it costs, and Give.
 */
function GiveSheet({ open, onClose, fish, book, fee, busy, onGive }: { open: boolean; onClose: () => void; fish: readonly SellEntry[]; book: ReadonlySet<string>; fee: number; busy: boolean; onGive: (f: SellEntry) => void }) {
  // A fish given leaves `fresh`, so its pick goes with it; closing forgets the pick.
  const [picked, setPicked] = useState<string | null>(null), close = () => { setPicked(null); onClose(); };
  const fresh = fish.filter(f => !book.has(f.item_key)), old = fish.filter(f => book.has(f.item_key));
  const chosen = fresh.find(f => f.item_key === picked) ?? null, teaches = chosen && teachOf(chosen.item_key), step = gaveLuck(book.size);
  const side = chosen ? <SidePanel picture={iconUrl(chosen.item_key)} kind="New to your collection" title={chosen.name} onClose={() => setPicked(null)} testId="give-pick"
      text={`${step > 0 ? `Luck ${pct(step)} for good` : "Your luck is at its most already, but it fills its slot"}${teaches ? `, and Bancha learns his ${teaches.name.toLowerCase()}` : ""}.`}
      facts={[["In your bag", `×${chosen.count}`], ["Costs", <>{fee}<CurrencyIcon size={13} /></>]]}
      actions={<DarkButton disabled={busy} onClick={() => onGive(chosen)} data-testid="give-fish"><span className={m.price}>Give {fee}<CurrencyIcon size={14} /></span></DarkButton>} />
    : null;
  return <FlatPanel open={open} onClose={close} title="Your bag" testId="give-bag">
    <StatusLine>Give Bancha a fish for your collection. The ones you&apos;ve given are greyed out.</StatusLine>
    {fish.length === 0 ? <Quiet>No fish in your bag. Catch one and bring it here.</Quiet> : <WithSide side={side}>
      <CardGrid label="Your fish" min={150} phoneMin={140}>
        {fresh.map(f => <ItemCard key={f.item_key} data-key={f.item_key} size="md" picture={iconUrl(f.item_key)} name={f.name} line={teachOf(f.item_key) ? "Teaches a dish" : "New to your collection"}
          pill={`×${f.count}`} arrow={false} rarity={f.rarity as Rarity} selected={picked === f.item_key} label={`${f.name}${teachOf(f.item_key) ? ", teaches a dish" : ""}`}
          onClick={() => setPicked(picked === f.item_key ? null : f.item_key)} />)}
        {old.map(f => <ItemCard key={f.item_key} data-key={f.item_key} size="md" picture={iconUrl(f.item_key)} name={f.name} line="In your collection" pill={`×${f.count}`} arrow={false}
          cover="given" label={`${f.name}, given already`} />)}
      </CardGrid>
    </WithSide>}
  </FlatPanel>;
}

/**
 * HQ's tank (round 6, David: "the hq tank will just be a seperate thing if you wanna drop but it doesnt do anything, its a
 * very small thing"): E at the tank, the kit's small panel. Pick a fish from your bag and drop it in: it leaves your bag
 * and swims with the club's (tasting_serve's 'tank'), and that is all. A fish not in your collection yet has a dot.
 */
export function TankSheet({ open, onClose, transport = httpEconomyTransport }: { open: boolean; onClose: () => void; transport?: EconomyTransport }) {
  const [data, setData] = useState<[SellEntry[], TastingView] | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const load = useCallback(() => Promise.all([transport.sellable(), transport.tasting()]).then(setData, e => setError(errText(e))), [transport]);
  useEffect(() => { if (open) { setError(null); setPicked(null); void load(); } }, [open, load]);
  const book = new Set((data?.[1].book ?? []).map(s => s.species_key));
  const fish = (data?.[0] ?? []).filter(e => tastingWater(e.item_key) && !e.locked && e.count > 0), chosen = fish.find(f => f.item_key === picked) ?? null;
  const drop = async (f: SellEntry) => {
    setBusy(true);
    try {
      await transport.serve(f.item_key, "tank", newKey());
      toast(`Plop. Your ${f.name.toLowerCase()} swims off with the others.`, iconUrl(f.item_key));
      window.dispatchEvent(new Event("tsi:tank"));
      onClose();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };
  return <FlatDialog open={open} onClose={onClose} title="HQ's tank" keys="e" testId="tank-sheet">
    <Quiet>{HQ_LINES.aquarium} Drop a fish in to swim with them. That&apos;s all it does.</Quiet>
    {error ? <StatusLine error>{error}</StatusLine> : null}
    {data === null ? <Quiet>Looking through your bag…</Quiet> : fish.length === 0 ? <Quiet>No fish in your bag.</Quiet>
      : <div className={m.tankRow}>{fish.map(f => <Thumb key={f.item_key} picture={iconUrl(f.item_key)} rarity={f.rarity} size={52} count={f.count} label={f.name}
        mark={!book.has(f.item_key)} tip={book.has(f.item_key) ? f.name : `${f.name}: not in your collection yet`} selected={picked === f.item_key}
        onClick={busy ? undefined : () => setPicked(picked === f.item_key ? null : f.item_key)} />)}</div>}
    <div className={m.tankAction}><DarkButton disabled={!chosen || busy} onClick={() => { if (chosen) void drop(chosen); }} data-testid="tank-drop">{chosen ? `Drop the ${chosen.name.toLowerCase()} in` : "Pick a fish"}</DarkButton></div>
  </FlatDialog>;
}
