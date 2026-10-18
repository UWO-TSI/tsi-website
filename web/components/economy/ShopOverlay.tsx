"use client";

/**
 * The shop overlay (David, 2026-10-18; specs/interiors/shop.md "The shop overlay"): one flat light-grey panel over
 * most of the screen, for the in-game items and the club merch alike. Coins and Gems top left as plain icon and number
 * pairs; a sidebar of shelf icons down the left; the shelf as a grid of white cards (the item's picture centred with
 * the pixel finish, its name and kind bottom left, its price in a grey pill, a tag, a small arrow). A card opens the
 * item in the same panel: the model large and turning on the left (drag to turn it), its kind, title, description,
 * stock, price and payment on the right, prev and next arrows, and a white band of specs along the bottom. At the
 * shop's counter it also sells your catches (Sell) and lists your merch pickups. Its pieces are the flat UI kit
 * (components/gui/flat), which the game's other menus share (specs/polish/flat-ui.md).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BadgePercent, HandCoins, House, KeyRound, LayoutGrid, Lock, Shirt, Sofa, Sticker, Ticket, Wrench } from "lucide-react";
import { ApiError, newKey } from "@/lib/apiClient";
import { AudioManager } from "@/lib/game/audio";
import { coinSteps, sellAtCounter } from "@/lib/game/shopCounter";
import { iconUrl, shopIcon } from "@/lib/icons/keys";
import { itemModel } from "@/lib/icons/itemModel";
import { httpEconomyTransport, type EconomyTransport, type MerchView } from "@/lib/wallet/transport";
import type { SellEntry, ShopEntry, ShopView } from "@/lib/wallet/service";
import { merchKind, merchSpecs, merchTag, MERCH_KINDS } from "@/lib/wallet/merchShelf";
import { SHELF_LABEL, itemLine, shelfItems, shopShelves, type ShopSection, type ShopShelf } from "@/lib/wallet/shopShelves";
import { CardGrid, Code, ColourDots, DarkButton, DetailView, FlatPanel, GhostButton, HairlineRow, HairlineRows, IconRail, InfoHead, ItemCard, Purse, Quiet, RowActions, STAGE, StatusLine,
  flatStyles as f } from "@/components/gui/flat";
import ItemViewer from "./ItemViewer";

const SHELF_ICON: Record<string, ReactNode> = {
  tools: <Wrench size={22} />, outfits: <Shirt size={22} />, furniture: <Sofa size={22} />, specials: <BadgePercent size={22} />, sell: <HandCoins size={22} />,
  merch: <LayoutGrid size={22} />, "merch:apparel": <Shirt size={22} />, "merch:accessories": <KeyRound size={22} />, "merch:stickers": <Sticker size={22} />, "merch:home": <House size={22} />,
  pickups: <Ticket size={22} />,
};
const KIND_LABEL = new Map(MERCH_KINDS.map(k => [k.id, k.label]));
const CATEGORY_LABEL: Record<string, string> = { tool: "Tools", outfit: "Clothes", accessory: "Accessories", hair: "Hair dye", furniture: "Furniture", wallpaper: "Wallpaper", flooring: "Flooring" };
const errText = (err: unknown) => (err instanceof ApiError ? (err.status === 401 ? "Sign in first." : err.message) : "Couldn't reach the shop. Try again.");
const picture = (e: ShopEntry) => e.sprite_url ?? shopIcon({ slug: e.slug, catalogue_ref: e.catalogue_ref, category: e.category });
/** An item's kind, the quiet line under its name. */
export const kindOf = (e: ShopEntry) => e.category === "merch" ? `${cap(KIND_LABEL.get(merchKind(e)) ?? "merch")} · Tethos club` : CATEGORY_LABEL[e.category] ?? cap(e.category);
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const tagOf = (e: ShopEntry) => e.category === "merch" ? merchTag(e.slug) : e.special ? "today's special" : null;

/** The spec row along the bottom of an item: the keychain's parts, else the merch's pickup, else kind, set and stock. */
export function specsOf(e: ShopEntry): [string, string][] {
  const own = e.category === "merch" ? merchSpecs(e.slug) : null;
  if (own) return own;
  const stock: [string, string] = ["Stock", e.stock === null ? "Always in stock" : e.stock > 0 ? `${e.stock} left` : "Sold out"];
  if (e.category === "merch") return [["Kind", cap(KIND_LABEL.get(merchKind(e)) ?? "merch")], ["Pick up", "HQ on campus"], stock];
  const set = e.tier ? `${cap(e.tier)} tier` : e.special ? "Today's special" : CATEGORY_LABEL[e.category] ?? cap(e.category);
  return [["Kind", CATEGORY_LABEL[e.category] ?? cap(e.category)], ["Set", set], stock];
}

/** The till: counting the readout from one balance to another in a few clinks (module scope: written to the DOM). */
function countUp(el: HTMLElement | null, from: number, to: number, timers: number[]) {
  if (!el) return;
  timers.forEach(window.clearTimeout);
  timers.length = 0;
  el.textContent = from.toLocaleString();
  coinSteps(from, to).forEach(({ value, at }, i, all) => timers.push(window.setTimeout(() => {
    el.textContent = value.toLocaleString();
    AudioManager.playSFX("click", { rate: 1.65 + i * 0.05, gain: i === all.length - 1 ? 0.5 : 0.3 });
  }, at)));
}

function Card({ e, onOpen }: { e: ShopEntry; onOpen: () => void }) {
  // An unpriced item (merch waiting on its price): "Price to come" on its pill, and its action off.
  return <ItemCard picture={picture(e)} name={e.name} line={e.owned > 0 && !e.can_buy ? "Owned" : itemLine(e)} tag={tagOf(e)}
    price={{ amount: e.price, currency: e.currency }} cover={e.stock === 0 ? "sold-out" : null}
    onClick={onOpen} label={`${e.name}, ${e.price} ${e.currency}`} testId="shop-card" />;
}

function Detail({ e, list, onPick, onBack, busy, onPay, viewer }: {
  e: ShopEntry; list: ShopEntry[]; onPick: (id: string) => void; onBack: () => void; busy: string | null; onPay: (e: ShopEntry) => void;
  /** A model of its own for the left pane (the keychain's), in place of the turning icon model. */
  viewer?: ReactNode | null;
}) {
  const i = list.findIndex(x => x.id === e.id);
  const prev = list[(i - 1 + list.length) % list.length], next = list[(i + 1) % list.length];
  const merch = e.category === "merch";
  const spec = useMemo(() => itemModel(e), [e]);
  // A hair dye's colour dots: the other dyes on the shelf.
  const dyes = e.category === "hair" ? list.filter(x => x.category === "hair") : [];
  const action = merch ? "Redeem" : e.owned > 0 && e.can_buy ? "Buy another" : e.owned > 0 ? "Owned" : "Buy";
  return <DetailView testId="shop-detail" onBack={onBack} hint={e.slug === "merch-tsi-lanyard" ? "Drag to slide along" : e.slug === "merch-genesis-sticker" ? "Drag to tilt" : undefined}
    stage={viewer ?? <ItemViewer key={e.id} spec={spec} picture={picture(e)} name={e.name} className={STAGE.stage} pictureClassName={STAGE.picture} />}
    steps={list.length > 1 ? { prev: { label: `Previous: ${prev.name}`, onClick: () => onPick(prev.id) }, next: { label: `Next: ${next.name}`, onClick: () => onPick(next.id) } } : null}
    info={<>
      <InfoHead kind={kindOf(e)} title={e.name} text={itemLine(e)} />
      {dyes.length > 1 && <ColourDots value={e.id} onPick={onPick}
        items={dyes.map(d => ({ id: d.id, label: d.name, background: `url(${picture(d)}) center 62% / 260% no-repeat` }))} />}
    </>}
    pay={{ price: { amount: e.price, currency: e.currency }, was: e.special ? e.base_price.toLocaleString() : null,
      action: { label: busy === e.id ? "One moment…" : e.stock === 0 ? "Sold out" : action, disabled: !e.can_buy || busy !== null || e.stock === 0, onClick: () => onPay(e) } }}
    fine={<>{merch ? "Pay with Gems. Reserve it here, then pick it up at HQ on campus." : `Pay with ${e.currency === "gems" ? "Gems" : "coins"}.`}
      {e.owned > 0 ? ` You own ${e.owned}.` : ""}</>}
    specs={specsOf(e)} />;
}

/** The counter's Sell: what's in your bag the shop buys, one or the stack. */
function SellPane({ transport, onSold }: { transport: EconomyTransport; onSold: (from: number, to: number, line: string, ok: boolean) => void }) {
  const [rows, setRows] = useState<SellEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => transport.sellable().then(r => { setRows(r); setError(null); }, () => setError("The shop's books didn't open. Try again.")), [transport]);
  useEffect(() => { void load(); }, [load]);
  const sell = async (e: SellEntry, qty: number) => {
    setBusy(e.item_key);
    const r = await sellAtCounter(transport, e, qty);
    if (r.ok) onSold(r.from, r.to, r.line, true); else { setError(r.error); onSold(0, 0, r.line, false); }
    await load();
    setBusy(null);
  };
  if (!rows) return <Quiet>{error ?? "Counting your pockets…"}</Quiet>;
  return <HairlineRows lead={<>Prices go by rarity. Donate your first of each species to the museum before you sell it. What you&apos;ve locked in your bag stays there.</>}>
    {error && <p className={f.error}>{error}</p>}
    {rows.length === 0 ? <Quiet>Nothing to sell yet. Go fishing, bug hunting or foraging, then come back.</Quiet>
      : rows.map(e => <HairlineRow key={e.item_key} art={iconUrl(e.item_key)} title={<>{e.name} <span className={f.quiet}>×{e.count}</span></>}
        detail={<>{cap(e.rarity)} {e.category} · {e.price_each.toLocaleString()} each</>}
        end={e.locked ? <span className={f.quiet}><Lock size={13} aria-hidden /> Locked</span> : <RowActions>
          <GhostButton disabled={busy !== null} onClick={() => void sell(e, 1)}>Sell 1</GhostButton>
          {e.count > 1 && <DarkButton size="sm" disabled={busy !== null} onClick={() => void sell(e, e.count)}>All · {(e.price_each * e.count).toLocaleString()}</DarkButton>}
        </RowActions>} />)}
  </HairlineRows>;
}

/** The merch you've reserved, with each pickup code. */
function Pickups({ transport }: { transport: EconomyTransport }) {
  const [view, setView] = useState<MerchView | null>(null);
  useEffect(() => { let live = true; transport.merch().then(v => { if (live) setView(v); }, () => {}); return () => { live = false; }; }, [transport]);
  const open = view?.reservations.filter(r => r.status === "reserved") ?? [];
  if (!view) return <Quiet>Looking up your pickups…</Quiet>;
  return <HairlineRows lead="Show the code at HQ on campus to pick it up.">
    {open.length === 0 ? <Quiet>Nothing waiting for you.</Quiet> : open.map(r => <HairlineRow key={r.id} title={r.item_name} detail={<>{r.gems.toLocaleString()} Gems</>}
      end={<Code>{r.pickup_code}</Code>} />)}
  </HairlineRows>;
}

export default function ShopOverlay({ open, onClose, title, section, sell = false, transport = httpEconomyTransport, keys, onBought, onSold, viewerFor, embedded, initialShelf }: {
  open: boolean; onClose?: () => void; title: string;
  /** The shopkeeper's answer: the game's things, or the club merch; both when absent. */
  section?: ShopSection;
  /** At the counter: the Sell shelf. */
  sell?: boolean;
  transport?: EconomyTransport; keys?: string;
  onBought?: (e: ShopEntry, line: string) => void;
  onSold?: (line: string, ok: boolean) => void;
  /** An item's own model for the detail's left pane (the keychain), where it has one; it fills `className`. */
  viewerFor?: (e: ShopEntry, className: string, pictureClassName: string) => ReactNode | null;
  /** On a page (the portal's shop pages): the same panel in the page, not over it. */
  embedded?: boolean;
  /** The shelf it opens on. */
  initialShelf?: ShopShelf | "pickups";
}) {
  const [view, setView] = useState<ShopView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [shelf, setShelf] = useState<ShopShelf | "pickups" | null>(initialShelf ?? null);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const coinsEl = useRef<HTMLSpanElement>(null), gemsEl = useRef<HTMLSpanElement>(null);
  const timers = useRef<number[]>([]);
  const keysFor = useRef(new Map<string, string>());
  const load = useCallback(() => transport.shop().then(v => { setView(v); setError(null); return v; }, err => { setError(errText(err)); return null; }), [transport]);
  useEffect(() => { if (open) void load(); }, [open, load]);
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const shelves: (ShopShelf | "pickups")[] = useMemo(() => {
    if (!view) return [];
    const list: (ShopShelf | "pickups")[] = shopShelves(view, section, sell);
    return section !== "items" ? [...list, "pickups"] : list;
  }, [view, section, sell]);
  const current = shelf && shelves.includes(shelf) ? shelf : shelves[0] ?? null;
  const items = view && current && current !== "pickups" ? shelfItems(view, current) : [];
  const item = items.find(e => e.id === picked) ?? null;

  const pay = async (e: ShopEntry) => {
    setBusy(e.id); setNote(null);
    const key = keysFor.current.get(e.id) ?? newKey();
    keysFor.current.set(e.id, key);
    try {
      if (e.currency === "gems" && e.category === "merch") {
        const r = await transport.reserve(e.id, key);
        setNote(`Reserved ${e.name}. Show pickup code ${r.reservation?.pickup_code ?? ""} at HQ on campus.`);
        if (gemsEl.current && view) gemsEl.current.textContent = r.gems_balance.toLocaleString();
      } else {
        const r = await transport.buy(e.id, 1, key);
        setNote(`Bought ${e.name}.`);
        if (r.currency === "coins") countUp(coinsEl.current, r.balance + r.price_each, r.balance, timers.current);
        onBought?.(e, `The ${e.name.toLowerCase()}, all yours. Thanks for stopping by!`);
      }
      keysFor.current.delete(e.id);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) keysFor.current.delete(e.id);
      setError(errText(err));
    } finally { setBusy(null); }
  };

  // A new shelf or an item opened fades in (the kit's micro animations, round 2).
  return <FlatPanel open={open} onClose={onClose} title={title} keys={keys} testId="shop-overlay" embedded={embedded} contentKey={`${current ?? ""}${item ? `:${item.id}` : ""}`}
    purse={<Purse coins={view ? view.coins : null} gems={view ? view.gems : null} coinsRef={coinsEl} gemsRef={gemsEl} />}
    rail={<IconRail label="Shelves" value={current} onChange={id => { setShelf(id); setPicked(null); setNote(null); }}
      items={shelves.map(id => ({ id, label: id === "pickups" ? "Your pickups" : SHELF_LABEL[id], icon: SHELF_ICON[id], badge: id === "specials" && view ? view.tabs.specials.length : undefined }))} />}>
    {(note || error) && <StatusLine error={!!error}>{error ?? note}</StatusLine>}
    {!view ? <Quiet>{error ? "" : "Opening the shop…"}</Quiet>
      : current === "sell" ? <SellPane transport={transport} onSold={(from, to, line, ok) => { if (ok) countUp(coinsEl.current, from, to, timers.current); onSold?.(line, ok); }} />
      : current === "pickups" ? <Pickups transport={transport} />
      : item ? <Detail e={item} list={items} onPick={setPicked} onBack={() => setPicked(null)} busy={busy} onPay={e => void pay(e)} viewer={viewerFor?.(item, STAGE.stage, STAGE.picture)} />
      : items.length === 0 ? <Quiet>{current === "specials" ? "No specials today. New picks go up at midnight, Toronto time." : current?.startsWith("merch") ? "New club merch arrives with the next order." : "The shopkeeper restocks with each update."}</Quiet>
      : <CardGrid title={current ? SHELF_LABEL[current] : ""}>{items.map(e => <Card key={e.id} e={e} onOpen={() => { setPicked(e.id); setNote(null); }} />)}</CardGrid>}
  </FlatPanel>;
}
