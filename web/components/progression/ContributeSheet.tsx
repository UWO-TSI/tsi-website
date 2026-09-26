"use client";

import { useMemo, useRef, useState } from "react";
import { COINS, fmtCoins } from "@/lib/economy";
import { localCollections, spendCollected } from "@/lib/game/collections";
import { localCoins, spendCoins } from "@/lib/game/coins";
import { deliver } from "@/lib/progression/client";
import { ApiError, newKey } from "@/lib/apiClient";
import { planContribution } from "@/lib/progression/goals";
import { itemDeliveryKind, itemLabel } from "@/lib/progression/items";
import { refreshProgression, useProgression } from "@/lib/progression/useProgression";
import type { DeliveryKind } from "@/lib/progression/types";
import ProgressionPanel, { type ProgressionSheetProps } from "./ProgressionPanel";
import s from "./progression.module.css";

const KIND_LABEL: Record<DeliveryKind, string> = { coins: `Coins ${COINS.symbol}`, material: "Materials", specimen: "Specimens" };

export function ContributeBody({ goalSlug }: { goalSlug?: string }) {
  const { state } = useProgression();
  const openGoals = state.goals.filter((g) => g.open && !g.completed);
  const [slug, setSlug] = useState(goalSlug ?? openGoals[0]?.slug ?? "");
  const goal = state.goals.find((g) => g.slug === slug) ?? openGoals[0] ?? null;
  const [kind, setKind] = useState<DeliveryKind>(goal?.accepts[0] ?? "coins");
  const [itemKey, setItemKey] = useState<string>("");
  const [amount, setAmount] = useState(100);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const keyRef = useRef<string | null>(null);
  const [wallet, setWallet] = useState(() => (typeof window === "undefined" ? 0 : localCoins()));
  const [items, setItems] = useState(() => (typeof window === "undefined" ? {} : localCollections()));

  const effectiveKind: DeliveryKind = goal && goal.accepts.includes(kind) ? kind : (goal?.accepts[0] ?? "coins");
  const itemChoices = useMemo(
    () => Object.entries(items).filter(([k, n]) => n > 0 && itemDeliveryKind(k) === effectiveKind).sort((a, b) => b[1] - a[1]),
    [items, effectiveKind],
  );
  const selectedItem = effectiveKind === "coins" ? null : itemChoices.some(([k]) => k === itemKey) ? itemKey : (itemChoices[0]?.[0] ?? null);
  const have = effectiveKind === "coins" ? wallet : selectedItem ? (items[selectedItem] ?? 0) : 0;
  const plan = goal
    ? planContribution({ goal, source: "delivery", kind: effectiveKind, amount, totals: { credited_points: goal.my_points, delivery_points: goal.my_delivery_points } })
    : null;

  if (!goal) return <p className={s.empty}>No club goal is taking deliveries right now.</p>;

  const submit = async () => {
    if (!plan?.ok || busy) return;
    setBusy(true);
    setMessage(null);
    // One key per delivery attempt; kept across retries until it lands.
    keyRef.current = keyRef.current ?? newKey();
    try {
      const receipt = await deliver({ goal_slug: goal.slug, kind: effectiveKind, amount, item_key: selectedItem }, keyRef.current);
      keyRef.current = null;
      if (receipt.amount_used > 0) {
        if (effectiveKind === "coins") spendCoins(receipt.amount_used, "goal_delivery");
        else if (selectedItem) spendCollected(selectedItem, receipt.amount_used);
      }
      setWallet(localCoins());
      setItems(localCollections());
      const text = receipt.completed_now
        ? `${goal.title}: complete! Thank you.`
        : `+${receipt.credited_points.toLocaleString()} pts to ${goal.title}${receipt.capped ? " (you've reached this goal's limit)" : ""}.`;
      setMessage({ kind: "ok", text });
      window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text } }));
      await refreshProgression();
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) keyRef.current = null;
      setMessage({ kind: "err", text: err instanceof ApiError ? err.message : "Couldn't reach the monument. Try again." });
    } finally {
      setBusy(false);
    }
  };

  const reason = !plan ? "" : plan.ok ? "" : plan.reason === "cap_reached" ? "You've given the most this goal accepts from one member." : plan.reason === "invalid_amount" ? "Enter a whole number." : "That doesn't count toward this goal.";
  const deliveryRoom = Math.max(0, Math.min(goal.caps.delivery - goal.my_delivery_points, goal.caps.member_total - goal.my_points));

  return (
    <div>
      {openGoals.length > 1 ? (
        <div className={s.field}>
          <span className={s.label}>Goal</span>
          <div className={s.choices}>
            {openGoals.map((g) => (
              <button key={g.slug} className={s.choice} aria-pressed={g.slug === goal.slug} onClick={() => { setSlug(g.slug); keyRef.current = null; }}>{g.title}</button>
            ))}
          </div>
        </div>
      ) : null}
      <p className={s.muted} style={{ margin: "0 0 12px" }}>{goal.title}: {goal.points.toLocaleString()} / {goal.target_points.toLocaleString()} pts ({goal.percent}%)</p>

      <div className={s.field}>
        <span className={s.label}>Deliver</span>
        <div className={s.choices}>
          {goal.accepts.map((k) => (
            <button key={k} className={s.choice} aria-pressed={k === effectiveKind} onClick={() => { setKind(k); keyRef.current = null; }}>
              {KIND_LABEL[k]} · {goal.weights[k]} pt{goal.weights[k] === 1 ? "" : "s"} each
            </button>
          ))}
        </div>
      </div>

      {effectiveKind !== "coins" ? (
        <div className={s.field}>
          <label className={s.label} htmlFor="contribute-item">Item</label>
          {itemChoices.length === 0 ? (
            <p className={s.muted}>Nothing to deliver yet. {effectiveKind === "specimen" ? "Catch fish or bugs first." : "Gather fruit or flowers first."}</p>
          ) : (
            <select id="contribute-item" className={s.input} value={selectedItem ?? ""} onChange={(e) => { setItemKey(e.target.value); keyRef.current = null; }}>
              {itemChoices.map(([k, n]) => <option key={k} value={k}>{itemLabel(k)} ({n})</option>)}
            </select>
          )}
        </div>
      ) : null}

      <div className={s.field}>
        <label className={s.label} htmlFor="contribute-amount">Amount</label>
        <input
          id="contribute-amount"
          className={s.input}
          type="number"
          min={1}
          max={Math.max(1, have)}
          value={amount}
          onChange={(e) => { setAmount(Math.floor(Number(e.target.value) || 0)); keyRef.current = null; }}
        />
        <span className={s.muted}>
          You have {effectiveKind === "coins" ? fmtCoins(have) : have.toLocaleString()} · you can add {deliveryRoom.toLocaleString()} more pts by delivery
        </span>
      </div>

      {plan?.ok ? (
        <p className={`${s.note} ${s.info}`}>
          Counts as <b>{plan.creditedPoints.toLocaleString()} pts</b>
          {plan.capped ? `: only ${plan.amountUsed.toLocaleString()} will be used, you'll reach your limit for this goal` : ""}.
        </p>
      ) : reason ? <p className={`${s.note} ${s.err}`}>{reason}</p> : null}
      {message ? <p role="status" className={`${s.note} ${message.kind === "ok" ? s.ok : s.err}`}>{message.text}</p> : null}

      <div className={s.actions}>
        <button className={s.btn} onClick={submit} disabled={!plan?.ok || busy || amount > have || state.source === "defaults"}>
          {busy ? "Delivering…" : "Deliver to the monument"}
        </button>
      </div>
      <p className={s.muted}>Club events count most: each QR check-in adds {goal.weights.event} pts and completed bounties add {goal.weights.bounty} pts, automatically.</p>
    </div>
  );
}

export default function ContributeSheet({ open, onClose, goalSlug }: ProgressionSheetProps & { goalSlug?: string }) {
  return (
    <ProgressionPanel open={open} onClose={onClose} title="Contribute">
      <ContributeBody key={goalSlug ?? "any"} goalSlug={goalSlug} />
    </ProgressionPanel>
  );
}
