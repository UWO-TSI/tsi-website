"use client";

/**
 * Row 312 on the island (specs/hq-onboarding.md): the HQ visit with Alice after Bram's tour, and the tools residents
 * hand over. The island hands this what it knows (where you are, what's open) and gets back what to show: the
 * tracker's quest, the HQ card that's due, what the wheel may hold, whether E at the desk talks to Alice.
 *
 * Alice's lines go through the residents' dialogue box (TalkBox) as a scripted talk; a tool's resident is talked to as
 * usual, their lines swapped for the teacher's (talkStore.script). Their talks' ends move things on: Alice's lines said,
 * a tool handed over. A catch (tsi:peaceful-got) finishes a tool's quest.
 */
import { useCallback, useEffect, useMemo } from "react";
import { toast } from "@/components/gui";
import { beginTalk, onTalkScript, startTalk, talkStore } from "@/lib/game/residentTalk";
import { fillName, parseTalkLine } from "@/lib/content/talk";
import { itemIcon } from "@/lib/game/toolWheel";
import type { TrackedQuest } from "@/lib/game/questTracker";
import { finishToolQuest, giveTool, hqEvent, hqSnapshot, setToolsTaught, startVisit, syncHq, useHq } from "@/lib/game/arrival/hq/store";
import { hqQuest, visitCue, waitingFor } from "@/lib/game/arrival/hq/visit";
import { givenKeys, handOver, isTaughtTool, questFinished, teacherOf, teacherTalk, toolQuest, type CatchKind } from "@/lib/game/arrival/hq/teachers";
import { TOOL_LINES, WREN, WREN_LINES, escPhrase, trackerEsc } from "@/lib/game/arrival/hq/lines";
import { HQ_END, HQ_END_TOUR, HQ_SCRIPT, type HqCard, type HqEvent } from "@/lib/game/arrival/hq/script";

const WREN_TALKER = { id: "hq:wren", slug: WREN.slug, name: WREN.name, post: WREN.post, seed: 3 };
/** Her lines wait this long after the room fades in (or a sheet closes): a breath, not a jump. */
const SAY_DELAY_MS = 450;
/** After Esc (the visit's last beat) the menu you opened stays up this long, to be seen, before her farewell closes it. */
const MENU_LOOK_MS = 2600;

export interface HqWorld {
  inside: string | null;
  /** Nothing over the room: no fade, no sheet, no map, no bag, nobody talking. */
  free: boolean;
  /** The Esc layer is open (the UI view). */
  menuOpen: boolean;
  touch: boolean;
  /** Your world name. */
  name: string | null;
  /** Gear the server's inventory says you own (usePeacefulContext). */
  owned: readonly string[];
  /** The arrival is playing (the walk-along's tracker is Bram's). */
  arriving: boolean;
  /** Close the Esc layer as Alice starts talking (her talk takes the screen). */
  closeMenu: () => void;
}

export function useHqOnboarding(w: HqWorld, dev: URLSearchParams | null) {
  const hq = useHq();
  const visit = hq.visit;
  // Where the account is in all this (another device's progress, a reload's).
  useEffect(() => { void syncHq(); }, []);
  // Dev previews: ?hqvisit=1 starts the visit (this account's tools taught; with ?hq=inside, at HQ); ?tools=taught
  // teaches the tools alone. And the evidence scripts' view of it (window.__hq).
  useEffect(() => {
    if (!dev) return;
    if (dev.get("hqvisit") === "1") { setToolsTaught(true); startVisit(); }
    else if (dev.get("tools") === "taught") setToolsTaught(true);
    Object.assign(window, { __hq: () => ({ ...hqSnapshot(), cue: hqSnapshot().visit && visitCue(hqSnapshot().visit!), waiting: waitingFor(hqSnapshot().visit) }) });
  }, [dev]);

  // What the wheel may hold: the inventory plus what a resident has handed over here (before it reads back).
  const owned = useMemo(() => [...new Set([...w.owned, ...givenKeys(hq.quests)])], [w.owned, hq.quests]);

  // A tool's resident: their teacher talk instead of their usual one (only while your tools are taught).
  useEffect(() => {
    talkStore.script = slug => {
      const t = teacherTalk(slug, { taught: hq.taught, owned, quests: hq.quests });
      return t && { script: t.script, lines: t.lines.map(parseTalkLine) };
    };
    return () => { talkStore.script = null; };
  }, [hq.taught, hq.quests, owned]);

  // Talks ending: Alice's lines said; a tool handed over (its offer), or asked for again (its nudge: the grant retried).
  useEffect(() => onTalkScript(script => {
    if (script === "hq") { hqEvent("said"); return; }
    const m = /^tool:(\w+):(offer|during)$/.exec(script);
    if (!m || !isTaughtTool(m[1])) return;
    const tool = m[1];
    if (m[2] === "during") { giveTool(tool); return; }
    if (!handOver(script, hqSnapshot().quests)) return;
    giveTool(tool);
    toast(TOOL_LINES[tool].given, itemIcon(teacherOf(tool)!.key));
  }), []);

  // A catch: the running tool quest it finishes (a bug for the net, a dig for the shovel). The tool is yours.
  useEffect(() => {
    const got = (e: Event) => {
      const d = (e as CustomEvent<{ kind?: string; bug?: boolean }>).detail;
      const kind: CatchKind = d?.bug || d?.kind === "bug" ? "bug" : d?.kind === "dig" ? "dig" : "forage";
      const tool = questFinished(kind, hqSnapshot().quests);
      if (!tool) return;
      finishToolQuest(tool);
      window.setTimeout(() => toast(TOOL_LINES[tool].done, itemIcon(teacherOf(tool)!.key)), 1400);
    };
    window.addEventListener("tsi:peaceful-got", got);
    return () => window.removeEventListener("tsi:peaceful-got", got);
  }, []);

  // The Esc menu, wherever you open it.
  useEffect(() => { if (w.menuOpen) hqEvent("esc"); }, [w.menuOpen]);

  // Alice says the beat's lines once you're at HQ with nothing over the room.
  // Bram's tour still on (HQ first): she sends you back out to him.
  const cue = visit ? visitCue(visit, HQ_SCRIPT, w.arriving ? HQ_END_TOUR : HQ_END) : null;
  const sayKeys = cue?.kind === "say" ? cue.keys.join("+") : null;
  const atHq = w.inside === "hq";
  const { free, name, touch, closeMenu } = w;
  const farewell = !!visit && visit.beat >= HQ_SCRIPT.length;
  useEffect(() => {
    if (!sayKeys || !atHq || !free) return;
    const t = window.setTimeout(() => {
      if (talkStore.active) return;
      const lines = sayKeys.split("+").flatMap(k => WREN_LINES[k] ?? [])
        .map(raw => parseTalkLine(fillName(raw.replaceAll("{esc}", escPhrase(touch)), name)));
      closeMenu();
      startTalk(beginTalk(WREN_TALKER, lines, performance.now() / 1000, "hq"));
    }, farewell ? MENU_LOOK_MS : SAY_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [sayKeys, atHq, free, name, touch, closeMenu, farewell]);

  /** The card due now (the register, the check-in card): at HQ with nothing else over the room. */
  const card: HqCard | null = cue?.kind === "card" && atHq && free ? cue.card : null;
  const waiting: HqEvent | null = waitingFor(visit);

  // The tracker: the visit while it runs, else a tool's quest.
  const quest: TrackedQuest | null = useMemo(() => {
    // Alice's visit while it runs (mid-walk too: HQ first), else nothing while Bram walks you round, else a tool's quest.
    if (visit && !visit.done) return hqQuest(visit, t => trackerEsc(t, touch));
    if (w.arriving) return null;
    return hq.taught ? toolQuest(hq.quests) : null;
  }, [w.arriving, visit, hq.taught, hq.quests, touch]);

  /** Bram's tour is over: a new arrival's tools are taught and the visit with Alice starts. */
  const arrived = useCallback((taught: boolean) => {
    if (!taught) return;
    setToolsTaught(true);
    // Not again if it ran mid-walk (HQ first) or the account already has it.
    if (!hqSnapshot().visit) startVisit();
  }, []);

  return { taught: hq.taught, visit, owned, quest, card, waiting, arrived };
}
