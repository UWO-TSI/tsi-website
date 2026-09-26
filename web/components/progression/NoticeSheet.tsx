"use client";

import { useState } from "react";
import { useProgression } from "@/lib/progression/useProgression";
import ContributeSheet from "./ContributeSheet";
import GoalCard from "./GoalCard";
import { LettersBody, type LettersTransport } from "./LettersSheet";
import ProgressionPanel, { type ProgressionSheetProps } from "./ProgressionPanel";
import s from "./progression.module.css";

/** Village notice board: club goals, the current objective, Village Hall notices. */
export function NoticeBody({ transport }: { transport?: LettersTransport }) {
  const { state } = useProgression();
  const [contributeSlug, setContributeSlug] = useState<string | null>(null);
  return (
    <div>
      {state.objective ? (
        <p className={`${s.note} ${s.info}`} style={{ marginTop: 0 }}>Your next step: <b>{state.objective.text}</b></p>
      ) : null}
      {state.goals.map((g) => <GoalCard key={g.slug} goal={g} waitingOnTitle={state.goals.find((x) => x.slug === g.locked_by)?.title} onContribute={setContributeSlug} />)}
      <div className={s.eyebrow} style={{ margin: "14px 0 8px" }}>Village Hall notices</div>
      <LettersBody transport={transport} systemOnly />
      <ContributeSheet open={contributeSlug !== null} goalSlug={contributeSlug ?? undefined} onClose={() => setContributeSlug(null)} />
    </div>
  );
}

export default function NoticeSheet({ open, onClose, transport }: ProgressionSheetProps & { transport?: LettersTransport }) {
  return (
    <ProgressionPanel open={open} onClose={onClose} title="Notice board">
      <NoticeBody transport={transport} />
    </ProgressionPanel>
  );
}
