"use client";

/**
 * The sushi bar's menu (f-sushi phase B; David, 2026-10-28: "BAR MENU SHOULD BE PAPER MENU LIKE REAL RESTAURANCE ...
 * these food should have a detailed food model on the menu and you can pick it up first person and hover over dishes
 * show what they do"). Seated at the bar, Menu picks it up: the camera leans in and looks down (SushiBar's readingView,
 * on tsi:bar-menu) while a printed paper menu rises into your hands and fills the view. Each dish shows its picture on
 * a plate (its high-def model's icon once made: DISH_ART; a marked stand-in until then); hovering one says what it
 * does in a line. Pick a dish, then order it: coins, or for the feast one of your own epic or legendary fish. The
 * server prices everything and rolls your casts with the meal's buff (lib/wallet/service.ts orderDish).
 */
import { useCallback, useEffect, useState } from "react";
import { Clock, Fish, Soup, X } from "lucide-react";
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
import { MenuRow, PaperHeading, PaperSheet, Thumb } from "@/components/gui/flat";
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
/** The menu's sections, as a real menu runs: the pot, the counter, the chef's, then what you bring. */
const SECTIONS: readonly [string, readonly string[]][] = [["From the pot", ["miso_soup"]], ["Nigiri and rolls", ["salmon_nigiri", "tuna_roll"]], ["The chef's", ["omakase"]], ["Bring your own", ["feast"]]];

/** A dish's picture on its plate: the icon of its high-def model once made, else its stand-in. */
function DishPicture({ id }: { id: string }) {
  const art = DISH_ART[id];
  return <PixelImage src={iconUrl(art ? (art.ready ? art.icon : art.standIn) : "lounge-tea")} px={40} />;
}

/** Tell the bar the menu is up or down: the seated camera leans in to read it (SushiBar). */
const lift = (up: boolean) => window.dispatchEvent(new CustomEvent("tsi:bar-menu", { detail: up }));

/** The menu picked up at the bar: paper in your hands, filling the view. */
export function MenuPickup({ open, onClose, transport = httpEconomyTransport }: { open: boolean; onClose: () => void; transport?: EconomyTransport }) {
  const state = usePresence(open, 380);
  const panel = useWorldDialog<HTMLDivElement>(open, onClose, "m");
  const [data, setData] = useState<[SushiView, SellEntry[]] | null>(null), [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null), [busy, setBusy] = useState(false);
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
  return <div className={m.layer} data-state={state}>
    <div className={m.vignette} onClick={onClose} aria-hidden />
    <div ref={panel} role="dialog" aria-modal aria-label="Menu" tabIndex={-1} data-gui-dialog data-gui-overlay className={m.hands} data-testid="sushi-menu">
      <PaperSheet className={m.menu}>
        <header className={m.head}>
          <p className={m.kicker}>Sushi by the sea</p>
          <h2 className={m.title}>Bancha&apos;s</h2>
        </header>
        {error ? <p className={m.error} role="status">{error}</p> : null}
        {SECTIONS.map(([title, ids]) => <section key={title} aria-label={title}>
          <PaperHeading>{title}</PaperHeading>
          {ids.map(id => menu.find(d => d.id === id)).filter((d): d is Dish => !!d).map(d => {
            const feast = d.price === null, open = picked === d.id;
            return <MenuRow key={d.id} open={open} picture={<DishPicture id={d.id} />} standIn={!DISH_ART[d.id]?.ready} name={d.name} note={d.blurb}
                does={<><Clock size={13} aria-hidden />{mealText(d.buff, d.buff.minutes)}</>}
                price={feast ? <Fish size={17} aria-label="Your fish" /> : <>{d.price}<CurrencyIcon size={16} /></>}
                onPick={() => setPicked(open ? null : d.id)}>
              <div className={m.orderLine}>
                {!feast ? <button type="button" className={m.order} disabled={busy} onClick={() => void order(d)}>Order<span>{d.price}<CurrencyIcon size={14} /></span></button>
                  : rare.length === 0 ? <span className={m.quiet}>Bring an epic or legendary fish.</span>
                  : rare.map(f => <Thumb key={f.item_key} picture={iconUrl(f.item_key)} rarity={f.rarity} size={52} count={f.count} label={`Cook my ${f.name}`} onClick={busy ? undefined : () => void order(d, f.item_key)} />)}
              </div>
            </MenuRow>;
          })}
        </section>)}
        <footer className={m.foot}>
          {buff ? <span className={m.meal}><Soup size={15} aria-hidden />{mealText(buff)} · {minutesLeft(buff)} min</span> : <span />}
          <button type="button" className={m.down} onClick={onClose} aria-label="Put the menu down"><X size={16} aria-hidden /></button>
        </footer>
      </PaperSheet>
    </div>
  </div>;
}
