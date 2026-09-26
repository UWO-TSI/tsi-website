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
import type { ResultView } from "@/lib/oracle/service";
import styles from "../DefaultIslandWorld.module.css";

export default function OracleSheetEmbed() {
  const [result, setResult] = useState<ResultView | null>(null);
  if (result) return <section className={`${styles.reveal} ${styles.revealEmbedded}`} role="status" style={{ ["--family" as string]: FAMILIES[result.family].color }}>
    <p className={styles.revealFamily}>{result.family}</p>
    <p>{FAMILIES[result.family].keeperLine}</p>
    <small>Aura unlocked · {result.type}</small>
  </section>;
  return <OracleQuizSheet open embedded onClose={() => {}} onResult={r => { setFamily(r.family); setResult(r); }} />;
}
