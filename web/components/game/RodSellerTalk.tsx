"use client";

/**
 * Gary's quest (David 2026-11-04: "it triggers a quest that allows you to talk to the rod guy and he asks u to trade
 * the flimsy rod for a training rod"; "rod seller will be named Gary"): E at the tackle counter while the quest is on
 * (lib/game/rods.ts trainingQuest) and Gary asks for your Flimsy rod, with two answers. The trade is the server's
 * (rod_training_trade): the Training rod comes in, the Flimsy goes, and the reward card says so; his thanks hints that
 * the rod grows the more you fish with it (its awakenings stay a surprise). It opens through the one dialog system
 * (useWorldDialog), in the talk box's place at the foot of the screen, as the shopkeeper does. Lines go through the
 * icon library (KeywordLine).
 */
import { useState } from "react";
import { Button, Dialogue } from "@/components/gui";
import { KeywordLine } from "@/components/gui/flat";
import { useWorldDialog } from "@/lib/game/useWorldDialog";
import { ROD_SELLER, TRAINING } from "@/lib/game/rods";
import { ApiError } from "@/lib/apiClient";
import { httpEconomyTransport, type EconomyTransport } from "@/lib/wallet/transport";
import talk from "./TalkBox.module.css";
import s from "./ShopkeeperChoice.module.css";

const SPEAKER = `${ROD_SELLER} · Tackle shop`;
export const ASK = `${TRAINING.quest.catches} fish on that old Flimsy rod? You've earned a better one. Trade me the Flimsy and this one's yours.`;
export const THANKS = "Here. It doesn't look like much yet, but it has potential. The more you fish with it, the more it grows.";

export default function RodSellerTalk({ open, onClose, transport = httpEconomyTransport }: { open: boolean; onClose: () => void; transport?: EconomyTransport }) {
  const panel = useWorldDialog<HTMLDivElement>(open, onClose);
  const [state, setState] = useState<"ask" | "busy" | "done">("ask"), [error, setError] = useState<string | null>(null);
  if (!open) return null;
  const trade = async () => {
    setState("busy"); setError(null);
    try {
      await transport.tradeForTraining();
      setState("done");
      window.dispatchEvent(new CustomEvent("tsi:gift", { detail: { key: "rod-training", name: "Training rod", title: "Traded", note: `Your Flimsy rod went to ${ROD_SELLER}.` } }));
      window.dispatchEvent(new Event("tsi:tools-changed"));
      window.dispatchEvent(new Event("tsi:gear-changed"));
    } catch (e) {
      setState("ask");
      setError(e instanceof ApiError ? e.message : "Couldn't reach the island. Try again.");
    }
  };
  const close = () => { setState("ask"); setError(null); onClose(); };
  return <div ref={panel} tabIndex={-1} role="dialog" aria-label={`Talking with ${ROD_SELLER}`} data-gui-dialog className={talk.talk} data-phase="speaking" data-ready data-testid="rod-seller">
    <Dialogue speaker={SPEAKER}>
      <p className={talk.line}>{error ?? <KeywordLine line={state === "done" ? THANKS : ASK} />}</p>
      <div className={s.choices}>
        {state === "done" ? <Button onClick={close}>Thanks</Button> : <>
          <Button onClick={() => void trade()} disabled={state === "busy"}>{state === "busy" ? "One moment…" : "Trade the Flimsy rod"}</Button>
          <Button onClick={close} disabled={state === "busy"}>Not yet</Button>
        </>}
      </div>
    </Dialogue>
  </div>;
}
