import { describe, expect, it } from "vitest";
import { HQ_END, HQ_END_TOUR, HQ_SCRIPT, type HqEvent } from "./script";
import { hqQuest, newVisit, parseVisit, visitCue, visitEvent, waitingFor, type HqState } from "./visit";
import { CHECKIN_CARD, FLY_CARDS, FOUNDER_PLAQUE, HQ_TRACKER, ID_CARD, LORE_CARD, TOOL_LINES, WREN_LINES, trackerEsc } from "./lines";
import { tourSteps } from "./uiTour";
import { END_LINE } from "../lines";

/** Play the visit through: say every line asked for, do what each beat waits for; the cues in order. */
function playThrough() {
  let s = newVisit();
  const seen: string[] = [];
  for (let guard = 0; guard < 50 && !s.done; guard++) {
    const cue = visitCue(s);
    if (cue?.kind === "say") { seen.push(`say:${cue.keys.join("+")}`); s = visitEvent(s, "said"); continue; }
    if (cue?.kind === "card") seen.push(`card:${cue.card}`);
    const wait = waitingFor(s)!;
    seen.push(`wait:${wait}`);
    s = visitEvent(s, wait);
  }
  return { s, seen };
}

describe("the HQ visit with Alice (row 312)", () => {
  it("runs in the v2 review's order: report, the lore, your ID, coins and gems, check-ins, menu, mail, minimap, the keys, Esc, goodbye", () => {
    expect(playThrough().seen).toEqual([
      "wait:wren",
      "say:welcome", "card:lore", "wait:lore",
      "say:idAsk", "card:id", "wait:signed",
      "say:idDone+coins", "card:fly:coins", "wait:flown",
      "say:gems", "card:fly:gems", "wait:flown",
      "say:events", "card:checkin", "wait:checkin",
      "say:menuFly", "card:fly:menu", "wait:flown",
      "say:mail", "card:fly:mail", "wait:flown",
      "say:minimap", "card:fly:minimap", "wait:flown",
      "say:tour", "card:tour", "wait:tour",
      "say:menu", "wait:esc",
      "say:farewell",
    ]);
    expect(playThrough().s.done).toBe(true);
  });

  it("is where Bram's tour hands you off: his last line sends you to Alice at HQ", () => {
    expect(END_LINE).toMatch(/Alice will want you signed in at HQ/);
  });

  it("starts by waiting for you at the desk: Bram's hand-off is the tracker's first step", () => {
    const s = newVisit();
    expect(visitCue(s)).toBeNull();
    expect(waitingFor(s)).toBe("wren");
    expect(hqQuest(s).steps[0]).toEqual({ id: "report", label: "Report to Alice at HQ", done: false });
  });

  it("moves on only for what the beat waits for, and only once she has said its lines", () => {
    let s: HqState = visitEvent(newVisit(), "wren");
    expect(visitCue(s)).toEqual({ kind: "say", keys: ["welcome"] });
    // The lore closed before she's asked (or anything else) changes nothing.
    for (const e of ["lore", "signed", "esc", "tour", "flown"] as HqEvent[]) expect(visitEvent(s, e)).toEqual(s);
    s = visitEvent(s, "said");
    expect(visitCue(s)).toEqual({ kind: "card", card: "lore" });
    // Esc pressed early isn't the lore read.
    expect(visitEvent(s, "esc")).toEqual(s);
    expect(visitEvent(s, "lore").beat).toBe(2);
  });

  it("ticks the tracker a step per beat, the Esc step with your key", () => {
    let s = newVisit();
    const q = () => hqQuest(s, t => trackerEsc(t, false));
    expect(q().steps.map(x => x.id)).toEqual(HQ_SCRIPT.map(b => b.id));
    expect(q().steps.find(x => x.id === "esc")?.label).toBe("Open the menu (Esc)");
    expect(hqQuest(s, t => trackerEsc(t, true)).steps.find(x => x.id === "esc")?.label).toBe("Open the menu");
    s = visitEvent(s, "wren");
    expect(q().steps.filter(x => x.done).map(x => x.id)).toEqual(["report"]);
    s = playThrough().s;
    expect(q().steps.every(x => x.done)).toBe(true);
  });

  it("picks up at the beat you were on after a reload (her lines again), and forgets nothing it shouldn't", () => {
    expect(parseVisit({ beat: 4, stage: "wait", done: false })).toEqual({ beat: 4, stage: "say", done: false });
    expect(parseVisit({ beat: 0, stage: "say", done: false })).toEqual({ beat: 0, stage: "wait", done: false });
    expect(parseVisit({ beat: 0, done: false })).toEqual(newVisit());
    expect(parseVisit({ done: true, beat: 7 })?.done).toBe(true);
    expect(parseVisit({ beat: 99 })).toBeNull();
    expect(parseVisit("nope")).toBeNull();
    expect(parseVisit(null)).toBeNull();
  });

  it("has every line it asks for, and the farewell last", () => {
    const keys = [...HQ_SCRIPT.flatMap(b => b.say ?? []), ...HQ_END, ...HQ_END_TOUR];
    for (const k of keys) expect(WREN_LINES[k]?.length, k).toBeGreaterThan(0);
    for (const b of HQ_SCRIPT) expect(HQ_TRACKER[b.id], b.id).toBeTruthy();
    expect(HQ_END.at(-1)).toBe("farewell");
  });

  it("with Bram's tour still on (HQ first), sends you back out to him", () => {
    let s = newVisit();
    for (let g = 0; g < 50 && !(s.beat >= HQ_SCRIPT.length); g++) s = visitEvent(s, visitCue(s)?.kind === "say" ? "said" : waitingFor(s)!);
    expect(visitCue(s, HQ_SCRIPT, HQ_END_TOUR)).toEqual({ kind: "say", keys: ["farewellTour"] });
    expect(WREN_LINES.farewellTour.join(" ")).toMatch(/Bram's waiting for you outside/);
  });

  it("points you at what's in HQ to look at, and keeps main-quest's Juno line in both farewells", () => {
    for (const k of ["farewell", "farewellTour"]) {
      const said = WREN_LINES[k].join(" ");
      expect(said, k).toMatch(/notice board/);
      expect(said, k).toMatch(/trophy case/);
      expect(said, k).toMatch(/bring it to Juno at the museum|Bring your first catch to Juno at the museum/);
    }
  });

  it("tells the island first (the Founder, the gatherings, GENESIS), and the money without a rate", () => {
    const lore = LORE_CARD.pages.map(p => p.text).join(" ");
    expect(lore).toMatch(/the Founder/);
    expect(lore).toMatch(/GENESIS/);
    expect(WREN_LINES.gems.join(" ")).toMatch(/real merch/);
    expect(WREN_LINES.gems.join(" ")).toMatch(/shipped/);
  });

  it("keeps to the lore: no Founder words written for David, no school words, no em dashes", () => {
    expect(FOUNDER_PLAQUE).toBeNull();
    const tour = tourSteps({ wheel: "tab", emote: "g", hud: "h", bag: "i", collection: "b", quests: "j", map: "m", mail: "l" });
    const all = [...Object.values(WREN_LINES).flat(), ...Object.values(HQ_TRACKER), ...LORE_CARD.pages.flatMap(p => [p.title, p.text]),
      ...Object.values(FLY_CARDS).flatMap(c => [c.name, c.text]), ...Object.values(ID_CARD), ...CHECKIN_CARD.steps, CHECKIN_CARD.note,
      ...tour.flatMap(t => [t.title, t.text]), ...Object.values(TOOL_LINES).flatMap(t => [t.title, t.step, t.given, t.done, ...t.offer, ...t.during])];
    for (const line of all) {
      expect(line, line).not.toMatch(/—/);
      // Real names never show in game: the island's founder is "the Founder".
      expect(line, line).not.toMatch(/\bDavid\b/);
      // Never a rate between the game's money and real money (the repo is public).
      expect(line, line).not.toMatch(/\$|\bCAD\b|dollar|\bcents?\b/i);
      expect(line, line).not.toMatch(/\b(school|campus|class(es)?|lesson|teacher|student|course|homework|curriculum|semester|robot|human|machine|android)\b/i);
    }
  });
});
