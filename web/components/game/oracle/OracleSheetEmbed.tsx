"use client";

/**
 * The Oracle inside GameWorld's OverlaySheet: the new reading (same sheet as
 * the island temple) replaces the legacy 12-question quiz. The full light
 * ceremony lives in the island temple; here the reveal is the keeper's card.
 */
import { useState } from "react";
import OracleQuizSheet from "./OracleQuizSheet";
import { FAMILIES } from "@/lib/game/oracle/family";
import { setFamily } from "@/lib/game/identity";
import type { Family } from "@/lib/oracle/engine";
import type { ResultView } from "@/lib/oracle/service";
import styles from "../DefaultIslandWorld.module.css";

/** The keeper's card after a reading: in the island temple (with Continue) and here. */
export function FamilyReveal({ family, type, embedded, onContinue }: { family: Family; type: string; embedded?: boolean; onContinue?: () => void }) {
  return <section className={`${styles.reveal} ${embedded ? styles.revealEmbedded : ""}`} role="status" style={{ ["--family" as string]: FAMILIES[family].color }} data-testid="oracle-reveal">
    <p className={styles.revealFamily}>{family}</p>
    <p>{FAMILIES[family].keeperLine}</p>
    <small>Aura unlocked · {type}</small>
    {onContinue && <button onClick={onContinue}>Continue</button>}
  </section>;
}

export default function OracleSheetEmbed() {
  const [result, setResult] = useState<ResultView | null>(null);
  if (result) return <FamilyReveal family={result.family} type={result.type} embedded />;
  return <OracleQuizSheet open embedded onClose={() => {}} onResult={r => { setFamily(r.family); setResult(r); }} />;
}
