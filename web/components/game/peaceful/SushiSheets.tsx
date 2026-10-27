"use client";

/**
 * The sushi bar's purpose (f-sushi phase B, specs/launch/sushi-bar.md): the menu on the counter while you sit (a dish for
 * coins, or the feast cooked from one of your own epic or legendary fish; each a fishing buff for a while), and by day
 * the chef's fishing order outside the closed bar (one special fish, paying coins and a staff meal). The server prices
 * everything and rolls your casts with the buff (lib/wallet/service.ts orderDish, fillFishRequest).
 */
import { useCallback, useState } from "react";
import { Check, ChefHat, Lock, Soup } from "lucide-react";
import type { MealBuff } from "@/lib/wallet/catalogue";
import type { ActiveBuff } from "@/lib/wallet/store";
import { newKey } from "@/lib/apiClient";
import { iconUrl } from "@/lib/icons/keys";
import { httpEconomyTransport, type EconomyTransport } from "@/lib/wallet/transport";
import { Amount } from "@/components/economy/Amount";
import { errText, useLoad } from "@/components/economy/EconomySheets";
import { Badge, Button, Empty, ErrorNote, Loading, SignInText } from "@/components/gui";
import ProgressionPanel from "@/components/progression/ProgressionPanel";
import p from "@/components/progression/progression.module.css";
import s from "@/components/economy/economy.module.css";

/** "Rarer fish and bigger fish, 30 min": what a meal does, in words. */
export function mealText(b: Pick<MealBuff, "luck" | "size">, minutes?: number) {
  const what = [b.luck > 0 && "rarer fish", b.size > 0 && "bigger fish"].filter(Boolean).join(" and ");
  const text = what ? what[0].toUpperCase() + what.slice(1) : "A warm meal";
  return minutes ? `${text}, ${minutes} min` : text;
}
const minutesLeft = (b: ActiveBuff) => Math.max(1, Math.round((new Date(b.until).getTime() - Date.now()) / 60_000));
const FEAST_RARITIES = ["epic", "legendary"];

export function SushiMenuBody({ transport = httpEconomyTransport }: { transport?: EconomyTransport }) {
  const load = useCallback(() => Promise.all([transport.sushi(), transport.sellable()]), [transport]);
  const { data, error, reload, setError } = useLoad(load);
  const [busy, setBusy] = useState(false);
  const [served, setServed] = useState<string | null>(null);
  const order = async (dish: string, name: string, fish?: string) => {
    setBusy(true);
    try {
      await transport.order(dish, newKey(), fish);
      setServed(name);
      await reload();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };
  if (!data) return error ? <ErrorNote onRetry={() => void reload()}><SignInText text={error} /></ErrorNote> : <Loading label="Reading the menu…" />;
  const [{ menu, buff }, stock] = data;
  const rare = stock.filter((e) => (e.category === "fish" || e.category === "sea") && FEAST_RARITIES.includes(e.rarity));
  return (
    <div>
      <p className={p.muted} style={{ marginBottom: 10 }}>Each meal helps your fishing for a while. A new meal replaces the last one.</p>
      {served ? <p role="status" className={`${p.note} ${p.ok}`}>Bancha sets down your {served.toLowerCase()}.</p> : null}
      {buff ? <p className={p.note}><Soup size={14} aria-hidden /> Your meal: {mealText(buff)}, {minutesLeft(buff)} more min.</p> : null}
      {error ? <ErrorNote><SignInText text={error} /></ErrorNote> : null}
      <ul className={s.list}>
        {menu.map((d) => (
          <li key={d.id} className={s.row}>
            <span>
              <b>{d.name}</b>
              <span className={p.muted} style={{ display: "block" }}>{d.blurb} {mealText(d.buff, d.buff.minutes)}.</span>
              {d.price === null ? <span className={s.rowActions} style={{ marginTop: 6 }}>
                {rare.length === 0 ? <span className={p.muted}>No epic or legendary fish in your bag yet.</span>
                  : rare.map((f) => f.locked ? <Badge key={f.item_key} tone="warn"><Lock size={12} aria-hidden /> {f.name} is locked</Badge>
                    : <Button key={f.item_key} size="sm" disabled={busy} onClick={() => order(d.id, d.name, f.item_key)}>Cook my {f.name}</Button>)}
              </span> : null}
            </span>
            {d.price !== null ? <Button size="sm" disabled={busy} onClick={() => order(d.id, d.name)}>Order · <Amount n={d.price} currency="coins" /></Button> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The menu on the counter while you sit at the bar. */
export const SushiMenuSheet = ({ open, onClose }: { open: boolean; onClose: () => void }) => (
  <ProgressionPanel open={open} onClose={onClose} title="Menu" icon={<ChefHat size={20} />}><SushiMenuBody /></ProgressionPanel>
);

export function ChefOrderBody({ transport = httpEconomyTransport }: { transport?: EconomyTransport }) {
  const load = useCallback(() => Promise.all([transport.requests(), transport.sellable()]), [transport]);
  const { data, error, reload, setError } = useLoad(load);
  const [busy, setBusy] = useState(false);
  const handOver = async (item: string) => {
    setBusy(true);
    try {
      await transport.fillRequest(item, newKey(), "chef");
      await reload();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };
  if (!data) return error ? <ErrorNote onRetry={() => void reload()}><SignInText text={error} /></ErrorNote> : <Loading label="Bancha looks up…" />;
  const [{ chef }, stock] = data;
  if (!chef) return <Empty icon={<ChefHat size={32} />} title="No order today">&ldquo;Nothing worth cooking is biting. Come back tomorrow.&rdquo;</Empty>;
  const have = stock.find((e) => e.item_key === chef.item_key);
  return (
    <div>
      <p className={p.muted} style={{ marginBottom: 10 }}>&ldquo;Bring me a {chef.name.toLowerCase()} today. I&apos;ll pay, and feed you.&rdquo; A new order every morning; the bar opens in the evening.</p>
      {error ? <ErrorNote><SignInText text={error} /></ErrorNote> : null}
      <ul className={s.list}>
        <li className={s.row} data-icon>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={s.rowIcon} src={iconUrl(chef.item_key)} alt="" width={36} height={36} />
          <span>
            <b>{chef.name}</b>{have ? <> ×{have.count}</> : null}
            <span className={p.muted} style={{ display: "block" }}>{chef.rarity} · pays <Amount n={chef.reward} currency="coins" /> and a staff meal ({mealText(chef.meal, chef.meal.minutes)})</span>
          </span>
          {chef.filled ? <Badge tone="success"><Check size={12} aria-hidden /> Done today</Badge>
            : have?.locked ? <Badge tone="warn"><Lock size={12} aria-hidden /> Locked in your bag</Badge>
            : <Button size="sm" disabled={busy || !have} onClick={() => handOver(chef.item_key)}>{have ? "Hand it over" : "None yet"}</Button>}
        </li>
      </ul>
    </div>
  );
}

/** The chef's order, by day outside the closed bar. */
export const ChefOrderSheet = ({ open, onClose, keys }: { open: boolean; onClose: () => void; keys?: string }) => (
  <ProgressionPanel open={open} onClose={onClose} title="The chef's order" keys={keys} icon={<ChefHat size={20} />}><ChefOrderBody /></ProgressionPanel>
);
