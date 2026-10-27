/**
 * The main quest on the island (specs/launch/v1-gameplay.md m1 to m6, t-next): the member's own chapter as the quest
 * dropdown lists it, and what its people say. Each chapter is an errand with a person and a place; when it's ready,
 * talking to its person finishes it (lib/progression/chapters.ts finishWith), and while it runs they nudge you on.
 * The rules are the server's; this only words them. Lines are DRAFTS for David's review.
 *
 * `{name}` is your world name; a line may open with a face ("[happy]", lib/content/talk.ts).
 */
import { STEP_RULES, finishWith, personalChapter } from "@/lib/progression/chapters";
import { MUSEUM_TARGETS } from "@/lib/progression/defaults";
import type { ChapterView, ProgressionState } from "@/lib/progression/types";
import type { TrackedQuest } from "./questTracker";

/** A step's line with its tally ("Catch 3 bugs 1/3"). */
export const stepLine = (s: Pick<ChapterView["steps"][number], "label" | "count" | "done">) =>
  s.count && !s.done ? `${s.label} ${s.count.have}/${s.count.need}` : s.label;

/** The club's museum so far (m5): what's in, and that it opens once it's full. */
export function museumLine(m: ProgressionState["museum"]): string {
  const t = MUSEUM_TARGETS;
  const full = m.fish >= t.fish && m.bugs >= t.bugs && m.finds >= t.finds;
  return `The club's museum so far: ${Math.min(m.fish, t.fish)} of ${t.fish} fish, ${Math.min(m.bugs, t.bugs)} of ${t.bugs} bugs, ${Math.min(m.finds, t.finds)} of ${t.finds} buried finds.`
    + (full ? " It's full, and opens with the next launch." : " It opens once it's full.");
}

/** The member's main quest for the tracker and the dropdown: their personal chapter, never a club goal. */
export function mainQuest(views: readonly ChapterView[], shown: boolean): TrackedQuest | null {
  const c = shown ? personalChapter(views) : null;
  if (!c || !c.steps.length) return null;
  const next = c.steps.find(s => !s.done);
  return { id: `chapter:${c.slug}`, title: c.title, kind: "chapter", steps: c.steps.map(s => ({ id: s.key, label: stepLine(s), done: s.done })), hint: next?.hint ?? null };
}

/** The place the step being worked on points at (the dropdown's arrow), and who's there. */
export function questTarget(views: readonly ChapterView[]): { anchor: ChapterView["steps"][number]["anchor"]; npc: string | null } | null {
  const c = personalChapter(views);
  const s = c?.steps.find(x => !x.done);
  return s ? { anchor: s.anchor, npc: s.npc ?? null } : null;
}

/**
 * Who stands where for the quest (x-teachers): each person the member's chapter sends them to, at its place, for the
 * whole chapter (so nobody walks off mid-errand). Their routine holds there meanwhile (components/game/NPC.tsx).
 */
export function questPosts(views: readonly ChapterView[]): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const s of personalChapter(views)?.steps ?? []) if (s.npc) out[s.npc] ??= s.anchor;
  return out;
}

type Lines = readonly string[];
/** By chapter requirement: what its person says while you're on it (`nudge`) and as it ends (`finish`). */
export const QUEST_LINES: Readonly<Record<string, { nudge: Lines; finish: Lines }>> = {
  settle_in: {
    nudge: [
      "[happy] Hello! I'm Juno. I show people round the museum.",
      "Bring me your first catch, any fish at all, and I'll show you what it's for. The end of the pier is a good place to start.",
    ],
    finish: [
      "[surprised] Is that your first catch? May I?",
      "[happy] This is what the museum is for. Members bring in fish, bugs and things dug out of the sand, and the first of each kind goes on show with a label.",
      "Odile curates the halls. I keep the door and the visitors. The more the club brings in, the fuller it gets.",
      "Here, a hundred coins from the museum, with our thanks. I'll write you a proper letter too. Check your mailbox.",
    ],
  },
  bug_net: {
    nudge: ["{count} so far. Bugs sit on flowers and trees. Walk up slowly and they'll stay put."],
    finish: [
      "[happy] Let me see them! Three, and every one in good shape.",
      "You've a gentle swing. Keep the net, it likes you.",
      "And a little something for the effort. Bring me anything new and it goes in a case.",
    ],
  },
  dig: {
    nudge: ["{count} so far. Look for the little star of cracks, on sand or on dirt. Perfectly good things under there!"],
    finish: [
      "[happy] Look at that haul! Perfectly good, every one of them.",
      "Some days the ground gives up something rare. Keep digging and you'll see.",
      "Here, for your trouble. The shovel's yours.",
    ],
  },
  rod_challenge: {
    nudge: [
      "Five kinds of fish, and one of them at dawn or dusk. That's the bet.",
      "{count}. The pier, the river and the pond all have their own.",
    ],
    finish: [
      "[surprised] Five kinds! And one caught as the light turned. Well, a bet's a bet.",
      "[happy] My Cedar rod. Lighter than the flimsy one, and a little lucky. It's in your bag.",
    ],
  },
  museum_collab: {
    nudge: ["{museum}", "Bring me something nobody's donated yet and it goes on show. {count} from you so far."],
    finish: [
      "[happy] Three new cases filled, and every label with your name on it.",
      "{museum}",
      "The whole club's doing this together. Thank you, {name}.",
    ],
  },
  pickaxe: {
    nudge: ["{count}. Swing at the big rocks. Stone mostly, and iron if you're lucky."],
    finish: [
      "[happy] Stone and iron! That's how the HQ's first wall went up, you know.",
      "Keep the pickaxe. It's done more good in your hands this week than on my wall in years.",
    ],
  },
};

/** A quest conversation: its script id (told to onTalkScript as it ends) and its lines. */
export interface QuestTalk { script: string; lines: readonly string[] }

/** `{count}`: the open step's tally ("1 of 3 bugs"); `{museum}`: the club's museum line. */
function fill(lines: Lines, c: ChapterView, museum: ProgressionState["museum"]): string[] {
  const open = c.steps.find(s => !s.done && s.count);
  const count = open?.count ? `${open.count.have} of ${open.count.need}` : "Nearly there";
  return lines.map(l => l.replaceAll("{count}", count).replaceAll("{museum}", museumLine(museum)));
}

/**
 * What a resident says for the main quest instead of their usual talk: the finish when the chapter is ready and they're
 * its person, a nudge while it runs. Null: not theirs now (a tool's offer is the teacher's talk, lib/game/arrival/hq).
 */
export function questTalk(views: readonly ChapterView[], slug: string, museum: ProgressionState["museum"]): QuestTalk | null {
  const c = personalChapter(views);
  if (!c) return null;
  const lines = QUEST_LINES[c.requirement];
  const done = finishWith(views, slug);
  if (done && lines) return { script: `quest:${c.slug}:${done.action}`, lines: fill(lines.finish, c, museum) };
  const finisher = STEP_RULES[c.requirement].find(r => r.finish)?.npc;
  const open = c.steps.find(s => !s.done);
  // Asking for the tool is the teacher's own offer.
  if (!lines || finisher !== slug || !open || (open.npc === slug && open.key.startsWith("get_"))) return null;
  return { script: `quest:${c.slug}:nudge`, lines: fill(lines.nudge, c, museum) };
}

/** A finished quest talk's script: the chapter and the action to send (null: a nudge, nothing to send). */
export function scriptAction(script: string): { chapter: string; action: "donate_catch" | "complete" } | null {
  const m = /^quest:([a-z0-9-]+):(donate_catch|complete)$/.exec(script);
  return m ? { chapter: m[1], action: m[2] as "donate_catch" | "complete" } : null;
}
