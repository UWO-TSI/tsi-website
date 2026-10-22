"use client";

import { useState } from "react";
import { ClipboardList, Flag } from "lucide-react";
import { useProgression } from "@/lib/progression/useProgression";
import { onBoard } from "@/lib/progression/seasonal";
import type { LetterView } from "@/lib/progression/types";
import { Card, Empty } from "@/components/gui";
import { Section } from "@/components/gui/cream";
import ClubGoal, { UpNextGoal, isUpNext } from "./ClubGoal";
import ContributeSheet from "./ContributeSheet";
import { LetterReader, lettersTransport, useLetters, when, type LettersTransport } from "./LettersSheet";
import ProgressionPanel, { type ProgressionSheetProps } from "./ProgressionPanel";
import m from "./menus.module.css";

/**
 * The village notice board (David, round 2: "notice board design needs to be simple and intuitive"): notices pinned up
 * on paper. The club's goal is the big one, with its bar and Contribute; beside it your next step on a sticky note,
 * what opens next, and HQ's notices, each one opening to read. Nothing else on the board.
 */
export function NoticeBody({ transport = lettersTransport }: { transport?: LettersTransport }) {
  const { state } = useProgression();
  const [contributeSlug, setContributeSlug] = useState<string | null>(null);
  const [reading, setReading] = useState<LetterView | null>(null);
  const mail = useLetters(transport);
  const board = state.goals.filter(onBoard);
  const open = board.filter((g) => !isUpNext(g)), next = board.filter(isUpNext);
  const notices = (mail.letters ?? []).filter((l) => l.kind === "system");
  if (reading) return <LetterReader letter={reading} transport={transport} onBack={() => setReading(null)} backLabel="The board" />;
  return (
    <div className={m.board}>
      <div className={m.boardMain}>
        {open.length ? open.map((g) => <ClubGoal key={g.slug} goal={g} look="notice" onContribute={setContributeSlug} />)
          : <Empty icon={<Flag size={32} />} title="No club goals right now">The next one goes up here.</Empty>}
      </div>
      <div className={m.boardSide}>
        {/* The notices stay paper in either palette (data-gui-paper). */}
        {state.objective ? <Card pinned tone="butter" tilt={1.2} className={m.nextStep} aria-label="Your next step" data-gui-paper="">
          <p className={m.kicker}>Your next step</p>
          <p>{state.objective.text}</p>
        </Card> : null}
        {next.length ? <Section title="Up next">
          {next.map((g) => <UpNextGoal key={g.slug} goal={g} waitingOnTitle={state.goals.find((x) => x.slug === g.locked_by)?.title} />)}
        </Section> : null}
        <Section title="From HQ">
          {mail.letters !== null && notices.length === 0 ? <p className={m.quietEmpty}>{mail.error === "signed-out" ? "Sign in to see HQ's notices." : mail.error ? "HQ's notices didn't load." : "No notices from HQ yet."}</p> : null}
          {notices.map((l, i) => <Card key={l.id} pinned tilt={i % 2 ? 0.8 : -0.7} className={m.slipCard} data-gui-paper="">
            <button type="button" className={m.slip} onClick={() => { setReading(l); void mail.read(l); }} aria-label={`${l.subject || "A notice"}, from HQ, ${when(l.created_at)}${l.read_at ? "" : ", unread"}`}>
              <span className={m.byline}>{l.read_at ? null : <span className={m.unread} aria-hidden="true" />}{when(l.created_at)}</span>
              <span className={m.slipTitle}>{l.subject || "A notice"}</span>
              <span className={m.slipText}>{l.body}</span>
            </button>
          </Card>)}
        </Section>
      </div>
      <ContributeSheet open={contributeSlug !== null} goalSlug={contributeSlug ?? undefined} onClose={() => setContributeSlug(null)} />
    </div>
  );
}

export default function NoticeSheet({ open, onClose, transport, keys }: ProgressionSheetProps & { transport?: LettersTransport; keys?: string }) {
  return (
    <ProgressionPanel open={open} onClose={onClose} title="Notice board" wide keys={keys} icon={<ClipboardList size={20} />}>
      <NoticeBody transport={transport} />
    </ProgressionPanel>
  );
}
