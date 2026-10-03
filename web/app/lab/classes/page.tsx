"use client";

import { useEffect, useState } from "react";
import { Badge, Button } from "@/components/gui";
import { STAT_DIRECTION_LABEL } from "@/lib/combat/classes";
import { FAMILIES } from "@/lib/game/oracle/family";
import { classRows, noteClass, noteLine, noteTime, readNotes, type PlaytestNote } from "@/lib/game/combat/playtest";
import type { Family } from "@/lib/oracle/engine";
import css from "./page.module.css";

const ORDER: Family[] = ["Arcane", "Ranger", "Vanguard", "Warden"];
const MASTERY = [1, 10, 20] as const;

/**
 * /lab/classes (specs/classes/playtest.md), dev-only like every lab page: the 16 subclasses by family, each kit as its
 * family wave lands (CLASS_KITS; the rest say "coming"), a mastery, and "Play in the ruins" (the island's combat demo
 * with classes v2 on, every form learned, the signature weapon in hand). Below, the notes jotted in the ruins (N).
 */
export default function ClassPlaytest() {
  const [rows] = useState(classRows);
  const [picked, setPicked] = useState(() => rows.find(r => r.kit)?.key ?? null);
  const [mastery, setMastery] = useState<number>(20);
  const [notes, setNotes] = useState<PlaytestNote[]>([]);
  const [copied, setCopied] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is read once after mount (the page server-renders)
  useEffect(() => { setNotes(readNotes().reverse()); }, []);
  const choice = rows.find(r => r.key === picked) ?? null;
  // A full page load: the combat demo builds its in-memory member from the query once per page.
  const play = () => { if (choice?.kit) window.location.assign(`/lab/island?combat=demo&classes=v2&subclass=${choice.key}&mastery=${mastery}&traits=all&ruins=1&playtest=1`); };
  const copy = async () => {
    try { await navigator.clipboard.writeText([...notes].reverse().map(noteLine).join("\n")); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { /* no clipboard: the list stays selectable */ }
  };
  return <main className={`${css.page} gui`}>
    <h1>Class playtest</h1>
    <p className={css.lead}>Pick a class and a mastery, then play it in the ruins. In there: the wrench (top right) switches class and mastery, fills the ult, turns on god mode and the spawner; the card on the left lists your keys (<b>H</b> hides it); <b>N</b> jots a note that lands at the bottom of this page.</p>
    {ORDER.map(family => <section key={family} className={css.family} style={{ ["--family" as string]: FAMILIES[family].color }} aria-label={family}>
      <h2><i aria-hidden="true" />{family} <small>{FAMILIES[family].blurb}</small></h2>
      <div className={css.row}>{rows.filter(r => r.family === family).map(r => {
        const body = <>
          <span className={css.top}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a small static class emblem */}
            <span className={css.icon} aria-hidden="true">{r.kit ? <img src={r.kit.look.icon} alt="" /> : r.name[0]}</span>
            <span className={css.name}><b>{r.name}</b><small>{r.style === "basic" ? "Basic-attack" : "Skill"} class</small></span>
          </span>
          <span className={css.fantasy}>{r.fantasy}</span>
          <span className={css.meta}><Badge tone="gold">Builds {STAT_DIRECTION_LABEL[r.stat].toLowerCase()}</Badge>
            <Badge tone={r.kit ? "success" : "neutral"}>{r.kit ? "Ready" : "Coming"}</Badge></span>
        </>;
        return r.kit
          ? <button key={r.key} type="button" className={css.card} aria-pressed={picked === r.key} onClick={() => setPicked(r.key)}>{body}</button>
          : <div key={r.key} className={css.card} data-coming aria-disabled="true" title="Its family wave hasn't landed yet">{body}</div>;
      })}</div>
    </section>)}
    <div className={css.bar}>
      <span className={css.seg} role="group" aria-label="Mastery">{MASTERY.map(m => <button key={m} type="button" aria-pressed={mastery === m} onClick={() => setMastery(m)}>{m}</button>)}</span>
      <p>{choice?.kit ? <><b>{choice.name}</b> at mastery {mastery}{mastery === 20 ? ", every skill open" : ""}</> : "Pick a class that's ready."}</p>
      <Button onClick={play} disabled={!choice?.kit}>Play in the ruins</Button>
    </div>
    <section className={css.notes} aria-label="Notes">
      <header><h2>Notes</h2>{notes.length > 0 && <Button variant="quiet" onClick={copy}>{copied ? "Copied" : "Copy all"}</Button>}</header>
      {notes.length ? <ol>{notes.map((n, i) => <li key={`${n.at}-${i}`}><small>{noteTime(n)} · {noteClass(n)}</small>{n.text}</li>)}</ol>
        : <p className={css.empty}>No notes yet. In the ruins, press N (or the Note button under the meter), type, and press Enter.</p>}
    </section>
  </main>;
}
