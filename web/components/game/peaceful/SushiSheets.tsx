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
 */
import { useCallback, useEffect, useState } from "react";
import { Clock, Fish, Ruler, Soup, Sparkles, X } from "lucide-react";
import { DISH_ART, SUSHI_MENU, type Dish, type MealBuff } from "@/lib/wallet/catalogue";
import type { ActiveBuff } from "@/lib/wallet/store";
import type { SellEntry, SushiView } from "@/lib/wallet/service";
import { newKey } from "@/lib/apiClient";
import { iconUrl } from "@/lib/icons/keys";
import { usePresence, useWorldDialog } from "@/lib/game/useWorldDialog";
import { httpEconomyTransport, type EconomyTransport } from "@/lib/wallet/transport";
import { CurrencyIcon } from "@/components/economy/Amount";
import PixelImage from "@/components/economy/PixelImage";
import { errText } from "@/components/economy/EconomySheets";
import { CoverTitle, FoldedMenu, Hanko, InkArt, InkDefs, MenuDish, PanelSection, Thumb, useInkId, type DishStat } from "@/components/gui/flat";
import { toast } from "@/components/gui";
import m from "./menu.module.css";

/** "Rarer fish and bigger fish, 30 min": what a meal does, in words. */
export function mealText(b: Pick<MealBuff, "luck" | "size">, minutes?: number) {
  const what = [b.luck > 0 && "rarer fish", b.size > 0 && "bigger fish"].filter(Boolean).join(" and ");
  const text = what ? what[0].toUpperCase() + what.slice(1) : "A warm meal";
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
export const COVER_LINE = "Sit anywhere. The rice is still warm.";

const MOST = { luck: Math.max(...SUSHI_MENU.map(d => d.buff.luck)), size: Math.max(...SUSHI_MENU.map(d => d.buff.size)) };
/** What a meal does, a row a stat beside its photo: rarer fish and bigger fish (as dots of the menu's most), how long. */
export function dishStats(b: MealBuff): DishStat[] {
  const dots = (v: number, most: number) => Math.max(1, Math.round((5 * v) / most));
  return [
    ...(b.luck > 0 ? [{ icon: <Sparkles />, label: "Rarer fish", value: `+${Math.round(b.luck * 100)}%`, level: dots(b.luck, MOST.luck) }] : []),
    ...(b.size > 0 ? [{ icon: <Ruler />, label: "Bigger fish", value: `+${Math.round(b.size * 100)}%`, level: dots(b.size, MOST.size) }] : []),
    { icon: <Clock />, label: "Lasts", value: `${b.minutes} min` },
  ];
}

/** Tell the bar the menu is up or down: the seated camera leans in to read it (SushiBar). */
const lift = (up: boolean) => window.dispatchEvent(new CustomEvent("tsi:bar-menu", { detail: up }));

/**
 * The menu picked up at the bar: a folded teahouse menu in your hands (David's references, 2026-10-28): its cover first
 * (the name top to bottom in ink, the hanko, a pagoda and a plum branch in mist), then two spreads you turn: the pot and
 * the counter's nigiri and rolls, then the chef's and the feast you bring the fish for. Each dish on its tray.
 */
export function MenuPickup({ open, onClose, transport = httpEconomyTransport }: { open: boolean; onClose: () => void; transport?: EconomyTransport }) {
  const state = usePresence(open, 380);
  const panel = useWorldDialog<HTMLDivElement>(open, onClose, "m");
  const [data, setData] = useState<[SushiView, SellEntry[]] | null>(null), [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const ink = useInkId();
  const load = useCallback(() => Promise.all([transport.sushi(), transport.sellable()]).then(setData, e => setError(errText(e))), [transport]);
  useEffect(() => {
    if (!open) return;
    lift(true);
    void load();
    setPicked(null);
    return () => { lift(false); };
  }, [open, load]);
  if (!state) return null;
  const menu = data?.[0].menu ?? SUSHI_MENU, buff = data?.[0].buff ?? null;
  const rare = (data?.[1] ?? []).filter(e => (e.category === "fish" || e.category === "sea") && FEAST_RARITIES.includes(e.rarity) && !e.locked);
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
      {buff ? <p className={m.meal}><Soup size={13} aria-hidden />{mealText(buff)} · {minutesLeft(buff)} min left</p> : null}
      <InkArt kind="bamboo" filter={ink} className={m.bamboo} />
    </>,
    <>
      <PanelSection title="Nigiri and rolls">{dish("salmon_nigiri")}{dish("tuna_roll")}</PanelSection>
      <InkArt kind="mist" filter={ink} fade="none" className={m.mistLow} />
    </>,
    <>
      <PanelSection title="The chef's">{dish("omakase")}</PanelSection>
      <InkArt kind="plum" filter={ink} fade="left" className={m.plumCorner} />
    </>,
    <>
      <PanelSection title="Bring your own">{dish("feast")}</PanelSection>
      <Hanko filter={ink} size={24} className={m.backSeal} />
      <InkArt kind="pagoda" filter={ink} className={m.pagodaLow} />
    </>,
  ];
  return <div className={m.layer} data-state={state}>
    <div className={m.vignette} onClick={onClose} aria-hidden />
    <div ref={panel} role="dialog" aria-modal aria-label="Menu" tabIndex={-1} data-gui-dialog data-gui-overlay className={m.hands} data-testid="sushi-menu">
      <InkDefs id={ink} />
      {error ? <p className={m.error} role="status">{error}</p> : null}
      <FoldedMenu cover={cover} panels={panels} label="Bancha's menu" onTurn={() => setPicked(null)} />
      <button type="button" className={m.down} onClick={onClose} aria-label="Put the menu down"><X size={16} aria-hidden /></button>
    </div>
  </div>;
}
