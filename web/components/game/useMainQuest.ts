"use client";

/**
 * The main quest on the island (lib/game/mainQuest.ts; specs/launch/v1-gameplay.md m1 to m6, t-next, x-teachers): the
 * member's chapter for the quest dropdown, its people's words (talkStore.quest) and their finish (a talk's end sends the
 * chapter's action; the server checks it and pays), the progress read back after each catch, the dawn-or-dusk catch,
 * where its people stand, and the guide arrow when the dropdown's quest is picked.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type * as THREE from "three";
import { toast } from "@/components/gui";
import { parseTalkLine } from "@/lib/content/talk";
import { onTalkScript, talkStore } from "@/lib/game/residentTalk";
import { clearGuide, showGuide } from "@/lib/game/guideArrow";
import { islandPhase } from "@/lib/game/islandTime";
import { resolveAnchor } from "@/lib/game/progressionBridge";
import { MUSEUM_DRIVE, mainQuest, opensDrive, questPosts, questTalk, questTarget, scriptAction } from "@/lib/game/mainQuest";
import { personalChapter } from "@/lib/progression/chapters";
import { advance } from "@/lib/progression/client";
import { refreshProgression, setProgressionState, useProgression } from "@/lib/progression/useProgression";

/** A catch is recorded by the server a moment after the reward card: the tallies are read back after this. */
const READ_BACK_MS = 1500;

export function useMainQuest(player: RefObject<THREE.Vector3>) {
  const { state } = useProgression();
  const views = state.chapters;
  const quest = useMemo(() => mainQuest(views, !state.hud_muted), [views, state.hud_muted]);
  const viewsRef = useRef(views);
  useEffect(() => { viewsRef.current = views; }, [views]);

  // Its people say the quest's lines first (a finish when it's ready, a nudge while it runs).
  const museum = state.museum;
  useEffect(() => {
    talkStore.quest = slug => {
      const t = questTalk(views, slug, museum);
      return t && { script: t.script, lines: t.lines.map(parseTalkLine) };
    };
    return () => { talkStore.quest = null; };
  }, [views, museum]);

  // A finish said through: the chapter's action. The server checks it, pays the reward and posts the letter.
  useEffect(() => onTalkScript(script => {
    // Odile's drive talk (m5): the hand-in sheet follows it.
    if (opensDrive(viewsRef.current, script)) { window.dispatchEvent(new CustomEvent(MUSEUM_DRIVE)); return; }
    const a = scriptAction(script);
    if (!a) return;
    const title = titleOf(viewsRef.current, a.chapter);
    advance(a.chapter, a.action)
      // The chapter's check-mark moment is tutorial-v2's QuestCheck ("tsi:quest-complete"); a level up follows it (LevelUpCard).
      .then(next => { setProgressionState(next); window.dispatchEvent(new CustomEvent("tsi:quest-complete", { detail: { title } })); })
      .catch(e => toast(e instanceof Error ? e.message : "That didn't go through. Try again."));
  }), []);

  // Catches, finds, donations and tools change the tallies: read them back once the server has them.
  useEffect(() => {
    let t = 0;
    const again = () => { window.clearTimeout(t); t = window.setTimeout(() => void refreshProgression(), READ_BACK_MS); };
    const events = ["tsi:peaceful-got", "tsi:dig-purse", "tsi:fish-caught", "tsi:curator-say", "tsi:tools-changed"];
    events.forEach(e => window.addEventListener(e, again));
    return () => { window.clearTimeout(t); events.forEach(e => window.removeEventListener(e, again)); };
  }, []);

  // Bram's challenge: a fish landed at dawn or dusk. The server checks the island's time and that the catch is fresh.
  useEffect(() => {
    const caught = () => {
      const c = personalChapter(viewsRef.current);
      if (c?.requirement !== "rod_challenge" || c.steps.find(s => s.key === "twilight_catch")?.done) return;
      const phase = islandPhase();
      if (phase !== "dawn" && phase !== "evening") return;
      window.setTimeout(() => {
        advance(c.slug, "twilight_catch").then(next => { setProgressionState(next); toast("Caught at dawn or dusk: Bram will want to hear."); }).catch(() => {});
      }, READ_BACK_MS);
    };
    window.addEventListener("tsi:fish-caught", caught);
    return () => window.removeEventListener("tsi:fish-caught", caught);
  }, []);

  // Where its people stand meanwhile (x-teachers), kept as one object while they don't change.
  const postsKey = JSON.stringify(questPosts(views));
  const posts = useMemo(() => JSON.parse(postsKey) as Record<string, string>, [postsKey]);

  // The dropdown's pick: the guide arrow to the step being worked on (its place, or the nearest bug, dig spot or rock),
  // until it's picked again or the chapter changes.
  const [guided, setGuided] = useState<string | null>(null);
  const guiding = !!quest && guided === quest.id;
  useEffect(() => {
    if (!guiding) { clearGuide("quest"); return; }
    return showGuide("quest", () => {
      const t = questTarget(viewsRef.current), p = player.current;
      const at = t && resolveAnchor(t.anchor, [p.x, p.z]);
      return at && { x: at[0], z: at[1] };
    }, { near: 4 });
  }, [guiding, player]);
  const guide = useCallback((id: string | null) => setGuided(id), []);

  return { quest, posts, guided: guiding ? guided : null, guide };
}

const titleOf = (views: readonly { slug: string; title: string }[], slug: string) => views.find(v => v.slug === slug)?.title ?? "Chapter";
