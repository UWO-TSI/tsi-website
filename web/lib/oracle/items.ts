/**
 * Oracle item bank (row 205): original Tethos wording, written for this game.
 * Not taken or adapted from any published personality instrument.
 *
 * 64 agree/disagree statements, 16 per dichotomy, half keyed to each pole
 * ("agree" pushes toward `pole`). 16 forced-choice tie-breakers (4 per
 * dichotomy) are served only when a dichotomy comes out exactly even.
 */
export type Dichotomy = "EI" | "SN" | "TF" | "JP";
export type Pole = "E" | "I" | "S" | "N" | "T" | "F" | "J" | "P";

export interface Statement {
  id: string;
  dichotomy: Dichotomy;
  pole: Pole;
  text: string;
}
export interface TieBreaker {
  id: string;
  dichotomy: Dichotomy;
  prompt: string;
  options: [{ label: string; pole: Pole }, { label: string; pole: Pole }];
}

const s = (id: string, dichotomy: Dichotomy, pole: Pole, text: string): Statement => ({ id, dichotomy, pole, text });

export const STATEMENTS: Statement[] = [
  // ── E / I: where energy comes from ─────────────────────────────────────────
  s("ei01", "EI", "E", "A packed plaza on festival night leaves me buzzing, not drained."),
  s("ei02", "EI", "I", "After a long club meeting I need quiet time before I feel like myself again."),
  s("ei03", "EI", "E", "I would rather talk a problem out loud than puzzle over it alone."),
  s("ei04", "EI", "I", "I often know what I think only after I have had time to write it down."),
  s("ei05", "EI", "E", "Walking up to a table of strangers at an event feels easy for me."),
  s("ei06", "EI", "I", "One long conversation with a close friend beats a night of meeting new people."),
  s("ei07", "EI", "E", "When the room goes quiet, I am usually the one who fills the silence."),
  s("ei08", "EI", "I", "I pick the fishing spot where nobody else is standing."),
  s("ei09", "EI", "E", "I get my best ideas in the middle of a lively group chat."),
  s("ei10", "EI", "I", "People sometimes learn I had an opinion only after the meeting ended."),
  s("ei11", "EI", "E", "A free evening with no plans makes me want to find someone to hang out with."),
  s("ei12", "EI", "I", "I enjoy a busy event more when I can step outside for a few minutes."),
  s("ei13", "EI", "E", "I like being the person who introduces friends to each other."),
  s("ei14", "EI", "I", "I would rather read the island guide than ask someone how things work."),
  s("ei15", "EI", "E", "Working at a shared study table keeps me more focused than working alone."),
  s("ei16", "EI", "I", "My favourite part of a trip is the quiet morning before everyone wakes up."),
  // ── S / N: what information gets attention ────────────────────────────────
  s("sn01", "SN", "S", "Give me a clear example before you explain the theory."),
  s("sn02", "SN", "N", "I often notice a pattern before I can say what the pieces are."),
  s("sn03", "SN", "S", "When I follow a recipe, I follow it to the gram."),
  s("sn04", "SN", "N", "I get restless doing a task the same way for the fifth time."),
  s("sn05", "SN", "S", "I remember exactly what someone wore and said the day we met."),
  s("sn06", "SN", "N", "I like asking what a project could become in five years, not just what it is now."),
  s("sn07", "SN", "S", "I trust what has worked before over a clever idea nobody has tried."),
  s("sn08", "SN", "N", "Metaphors help me understand things faster than step-by-step lists."),
  s("sn09", "SN", "S", "I notice when a shelf is a centimetre off level."),
  s("sn10", "SN", "N", "My mind wanders to what-ifs while other people are still on the facts."),
  s("sn11", "SN", "S", "I would rather fix the thing in front of me than redesign the whole system."),
  s("sn12", "SN", "N", "I enjoy stories that leave the ending open for me to imagine."),
  s("sn13", "SN", "S", "A good map with exact distances beats a vague sense of direction."),
  s("sn14", "SN", "N", "I often connect ideas from two unrelated classes in one assignment."),
  s("sn15", "SN", "S", "I like to learn a tool by using it, not by reading about it."),
  s("sn16", "SN", "N", "I get excited by plans that nobody has figured out how to build yet."),
  // ── T / F: how decisions get made ──────────────────────────────────────────
  s("tf01", "TF", "T", "When two friends disagree, I first ask which argument is actually correct."),
  s("tf02", "TF", "F", "Before deciding, I think about how each person in the group will feel about it."),
  s("tf03", "TF", "T", "Honest feedback is kinder than feedback softened until it says nothing."),
  s("tf04", "TF", "F", "I will change a good plan if it would leave someone on the team behind."),
  s("tf05", "TF", "T", "I like rules that apply the same way to everyone, even when it stings."),
  s("tf06", "TF", "F", "I can usually tell when someone is upset before they say anything."),
  s("tf07", "TF", "T", "A spreadsheet of pros and cons settles most choices for me."),
  s("tf08", "TF", "F", "I judge a club by how welcome it makes new people feel."),
  s("tf09", "TF", "T", "In a debate, I will argue the side I disagree with just to test it."),
  s("tf10", "TF", "F", "Keeping the peace in a group matters to me as much as getting it right."),
  s("tf11", "TF", "T", "I would rather be respected for being fair than liked for being nice."),
  s("tf12", "TF", "F", "I remember how a decision made people feel long after I forget the details."),
  s("tf13", "TF", "T", "When a project fails, I look for the cause before I look for comfort."),
  s("tf14", "TF", "F", "I choose gifts by thinking about what the person would love, not what is useful."),
  s("tf15", "TF", "T", "Criticism of my work does not feel like criticism of me."),
  s("tf16", "TF", "F", "I say yes to helping out even when my own list is long."),
  // ── J / P: how the outer world gets organised ─────────────────────────────
  s("jp01", "JP", "J", "I feel calmer once the plan for the week is written down."),
  s("jp02", "JP", "P", "My best work often happens right before the deadline."),
  s("jp03", "JP", "J", "I finish one task completely before starting the next."),
  s("jp04", "JP", "P", "I like keeping my options open until I have to choose."),
  s("jp05", "JP", "J", "An unanswered group-chat question bothers me until it is settled."),
  s("jp06", "JP", "P", "A surprise change of plans usually sounds fun to me."),
  s("jp07", "JP", "J", "I pack for a trip days ahead, with a checklist."),
  s("jp08", "JP", "P", "I explore a new island by wandering, not by following a route."),
  s("jp09", "JP", "J", "I set my Pomodoro timer and stick to it."),
  s("jp10", "JP", "P", "My room is organised in a way only I understand."),
  s("jp11", "JP", "J", "I would rather decide quickly and adjust than keep debating."),
  s("jp12", "JP", "P", "I start several projects at once and switch between them as the mood takes me."),
  s("jp13", "JP", "J", "Late arrivals to a meeting I planned throw off my whole afternoon."),
  s("jp14", "JP", "P", "Rules feel more like suggestions to me when the situation is new."),
  s("jp15", "JP", "J", "I like knowing exactly when an event starts and ends."),
  s("jp16", "JP", "P", "I often find a better idea halfway through and switch to it."),
];

const t = (id: string, dichotomy: Dichotomy, prompt: string, a: [string, Pole], b: [string, Pole]): TieBreaker => ({
  id, dichotomy, prompt, options: [{ label: a[0], pole: a[1] }, { label: b[0], pole: b[1] }],
});

export const TIE_BREAKERS: TieBreaker[] = [
  t("ei-t1", "EI", "A free Saturday on the island. You spend it…", ["at the plaza, seeing who turns up", "E"], ["on your own island, decorating", "I"]),
  t("ei-t2", "EI", "You just caught a rare fish. First thing you do?", ["Show whoever is nearby", "E"], ["Quietly add it to your journal", "I"]),
  t("ei-t3", "EI", "The club needs someone for…", ["greeting new members at the door", "E"], ["writing the welcome guide", "I"]),
  t("ei-t4", "EI", "You think best…", ["while talking", "E"], ["before talking", "I"]),
  t("sn-t1", "SN", "The keeper hands you an old map. You look first at…", ["the landmarks and distances", "S"], ["the blank corner nobody has explored", "N"]),
  t("sn-t2", "SN", "A good instruction is…", ["precise", "S"], ["inspiring", "N"]),
  t("sn-t3", "SN", "You would rather build…", ["a bench that will last ten years", "S"], ["a machine nobody has seen before", "N"]),
  t("sn-t4", "SN", "In a story, you remember…", ["what happened", "S"], ["what it meant", "N"]),
  t("tf-t1", "TF", "A teammate's code is messy but they worked all night. You…", ["point out the bugs first", "T"], ["thank them first", "F"]),
  t("tf-t2", "TF", "A fair decision is one that is…", ["consistent", "T"], ["considerate", "F"]),
  t("tf-t3", "TF", "You would rather be called…", ["sharp", "T"], ["warm", "F"]),
  t("tf-t4", "TF", "Settling an argument, you rely on…", ["evidence", "T"], ["empathy", "F"]),
  t("jp-t1", "JP", "The club trip itinerary should be…", ["planned to the hour", "J"], ["a rough idea and a map", "P"]),
  t("jp-t2", "JP", "Your study session ends…", ["when the timer says so", "J"], ["when the chapter feels done", "P"]),
  t("jp-t3", "JP", "A to-do list is…", ["a promise", "J"], ["a suggestion", "P"]),
  t("jp-t4", "JP", "You prefer things…", ["settled", "J"], ["open", "P"]),
];
