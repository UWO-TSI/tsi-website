"use client";

/**
 * /dev/progression?sheet=journal|goals|letters|contribute|notice|reader|compose[&demo=1][&goal=0.6]
 * demo=1 runs the real service against an in-memory store (no network) so
 * the sheets show mid-game state; without it the sheets call the live API.
 * ?admin=goal|chapter|seasonal[&event=<slug>] previews an editor.
 */
import { useEffect, useState } from "react";
import { useSearch } from "@/lib/game/useMediaQuery";
import ContributeSheet from "@/components/progression/ContributeSheet";
import JournalSheet from "@/components/progression/JournalSheet";
import LettersSheet, { type LettersTransport } from "@/components/progression/LettersSheet";
import NoticeSheet from "@/components/progression/NoticeSheet";
import ClubGoalEditor from "@/components/portal/ClubGoalEditor";
import QuestChapterEditor from "@/components/portal/QuestChapterEditor";
import { DEFAULT_CHAPTERS, DEFAULT_GOALS, SEASONAL_GOALS } from "@/lib/progression/defaults";
import { memoryStore } from "@/lib/progression/memoryStore";
import { advanceChapter, contribute, loadState, sendNote, syncRealActivity } from "@/lib/progression/service";
import { setProgressionState } from "@/lib/progression/useProgression";
import { routeDemoFetch } from "@/lib/game/demoFetch";
import { DEMO_MEMBER as ME, progressionRoutes } from "@/lib/game/progressionDemo";

const FRIENDS = ["Maya Chen", "Jordan Park", "Priya Shah", "Leo Martin"].map((name, i) => ({ id: `00000000-0000-4000-8000-00000000010${i}`, display_name: name }));

async function demo(): Promise<LettersTransport> {
  const m = memoryStore();
  const now = new Date();
  m.addMember(ME, { tier: 4, firstCatchKey: "fish_dace" }, 2400);
  FRIENDS.forEach((f) => m.addMember(f.id, {}, 5000));
  await advanceChapter(m.store, ME, { chapter_slug: "settle-in", action: "claim_plot" }, now);
  for (const [i, f] of FRIENDS.entries()) await contribute(m.store, f.id, { goal_slug: "reopen-cafe", kind: "coins", amount: 900 + i * 150, item_key: null, idempotency_key: `delivery:demo-${i}` }, now);
  await contribute(m.store, ME, { goal_slug: "reopen-cafe", kind: "coins", amount: 350, item_key: null, idempotency_key: "delivery:demo-me" }, now);
  // Whichever seasonal event is open today gets some club progress too.
  for (const g of SEASONAL_GOALS) for (const [i, f] of FRIENDS.entries()) await contribute(m.store, f.id, { goal_slug: g.slug, kind: "coins", amount: 1200 + i * 200, item_key: null, idempotency_key: `delivery:demo-${g.slug}-${i}` }, now);
  for (let i = 0; i < 9; i++) m.activity.push({ source: "event", ref_id: `00000000-0000-4000-8000-0000000e00${String(i).padStart(2, "0")}`, member_id: FRIENDS[i % FRIENDS.length].id });
  await syncRealActivity(m.store, m.goals[0], now);
  await m.store.sendSystemLetter(ME, "welcome", "Welcome to the island", "HQ is glad you're here. Your journal lists what to do next; the plaza monument shows how the club is doing on the cafe.");
  await sendNote(m.store, FRIENDS[0].id, { to: ME, subject: "Fishing Friday?", body: "Heading to the pier after the workshop on Friday. The dace have been biting near the rocks. Come along!" }, now);
  await sendNote(m.store, FRIENDS[1].id, { to: ME, body: "Thanks for helping set up the event yesterday. The cafe fund jumped!" }, now);
  const state = await loadState(m.store, ME, now);
  if (state.ok) setProgressionState(state.data);
  // Route the sheets' own /api/progression and wallet calls to the same in-memory service.
  routeDemoFetch("/api/", progressionRoutes(m, ME));
  try {
    localStorage.setItem("tsi.collections.local.v1", JSON.stringify({ fish_dace: 3, fish_pale_chub: 1, flower_tulip: 6, apple: 4 }));
  } catch {
    /* preview only */
  }
  const names = new Map(FRIENDS.map((f) => [f.id, f.display_name]));
  return {
    list: async () => (await m.store.listLetters(ME, 50)).map((l) => ({ ...l, sender_name: l.sender_id ? (names.get(l.sender_id) ?? "Member") : "HQ", recipient_name: names.get(l.recipient_id) ?? "you" })),
    send: async (to, subject, body) => sendNote(m.store, ME, { to, subject, body }, new Date()),
    markRead: (id) => m.store.markLetterRead(ME, id, new Date().toISOString()),
    report: (id, reason) => m.store.reportLetter(ME, id, reason, new Date().toISOString()),
    searchMembers: async (q) => FRIENDS.filter((f) => f.display_name.toLowerCase().includes(q.toLowerCase())),
  };
}

export default function Harness() {
  const search = useSearch();
  return search === null ? null : <HarnessBody params={new URLSearchParams(search)} />;
}

function HarnessBody({ params }: { params: URLSearchParams }) {
  const [sheet, setSheet] = useState<string | null>(params.get("sheet") ?? "journal");
  const [transport, setTransport] = useState<LettersTransport | undefined>(undefined);
  const isDemo = params.get("demo") === "1";
  const [ready, setReady] = useState(!isDemo);

  useEffect(() => {
    if (!isDemo) return;
    void demo().then((t) => {
      setTransport(t);
      setReady(true);
    });
  }, [isDemo]);

  const close = () => setSheet(null);
  const admin = params.get("admin");
  if (admin) {
    // Editor preview without the T1/T2 gate (dev only); saving still goes through the real API.
    return (
      <main style={{ minHeight: "100dvh", padding: "32px 24px", background: "var(--color-bg-main, #0f0f10)" }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          {admin === "goal" ? <ClubGoalEditor mode="edit" initial={DEFAULT_GOALS[0]} />
            : admin === "seasonal" ? <ClubGoalEditor mode="edit" initial={SEASONAL_GOALS.find((g) => g.slug === params.get("event")) ?? SEASONAL_GOALS[0]} seasonal />
            : <QuestChapterEditor mode="edit" initial={DEFAULT_CHAPTERS[0]} goalSlugs={DEFAULT_GOALS.map((g) => g.slug)} />}
        </div>
      </main>
    );
  }
  return (
    <main style={{ minHeight: "100dvh", background: "linear-gradient(180deg, #a9d8e6 0%, #cfe7cf 55%, #9cc58f 100%)", fontFamily: "system-ui, sans-serif" }}>
      <nav style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 16 }}>
        {["journal", "goals", "letters", "contribute", "notice"].map((k) => (
          <button key={k} onClick={() => setSheet(k)} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #5c746c55", background: "#f8f7e9" }}>{k}</button>
        ))}
      </nav>
      {ready ? (
        <>
          <JournalSheet open={sheet === "journal" || sheet === "goals"} initialTab={sheet === "goals" ? "goals" : "quests"} onClose={close} />
          <ContributeSheet open={sheet === "contribute"} goalSlug="reopen-cafe" onClose={close} />
          <LettersSheet open={sheet === "letters" || sheet === "reader" || sheet === "compose"} transport={transport} onClose={close} />
          <NoticeSheet open={sheet === "notice"} transport={transport} onClose={close} />
        </>
      ) : null}
    </main>
  );
}
