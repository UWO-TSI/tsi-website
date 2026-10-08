"use client";

/**
 * The Oracle inside GameWorld's OverlaySheet: the new reading (same sheet as
 * the island temple) replaces the legacy 12-question quiz. The full light
 * ceremony lives in the island temple; here the reveal is the keeper's card.
 */
import { useState } from "react";
import { usePresence } from "@/lib/game/useWorldDialog";
import OracleQuizSheet from "./OracleQuizSheet";
import { FAMILIES } from "@/lib/game/oracle/family";
import { setFamily } from "@/lib/game/identity";
import type { Family } from "@/lib/oracle/engine";
import type { ResultView } from "@/lib/oracle/service";
import styles from "../DefaultIslandWorld.module.css";

type Reading = { family: Family; type: string };

/**
 * The keeper's card after a reading: in the island temple (with Continue) and here. `open` given (the temple): it
 * stays mounted and fades out with what it last showed when it closes (audit-2026-10-ui item 4); without it, it is
 * simply shown.
 */
export function FamilyReveal({ open, family, type, embedded, onContinue }: { open?: boolean; family: Family | null; type: string; embedded?: boolean; onContinue?: () => void }) {
  const showing = open ?? true;
  const state = usePresence(showing && !!family, 260);
  const [kept, setKept] = useState<Reading | null>(family ? { family, type } : null);
  if (showing && family && (kept?.family !== family || kept.type !== type)) setKept({ family, type });
  const shown = showing && family ? { family, type } : kept;
  if (!state || !shown) return null;
  return <section className={`${styles.reveal} ${embedded ? styles.revealEmbedded : ""}`} role="status" style={{ ["--family" as string]: FAMILIES[shown.family].color }} data-testid="oracle-reveal"
    data-state={open === undefined ? undefined : state}>
    <p className={styles.revealFamily}>{shown.family}</p>
    <p>{FAMILIES[shown.family].keeperLine}</p>
    <small>Aura unlocked · {shown.type}</small>
    {onContinue && <button onClick={onContinue}>Continue</button>}
  </section>;
}

export default function OracleSheetEmbed() {
  const [result, setResult] = useState<ResultView | null>(null);
  if (result) return <FamilyReveal family={result.family} type={result.type} embedded />;
  return <OracleQuizSheet open embedded onClose={() => {}} onResult={r => { setFamily(r.family); setResult(r); }} />;
}
