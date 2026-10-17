import { describe, expect, it } from "vitest";
import { TOOL_TEACHERS, givenKeys, handOver, parseQuests, questFinished, teacherTalk, toolQuest, type TeachContext } from "./teachers";
import { TOOL_LINES } from "./lines";
import { PROPOSED_RESIDENTS } from "@/lib/content/residentRoster";
import { toolByKey, TAUGHT_KINDS } from "@/lib/game/tools";
import { wheelContents } from "@/lib/game/toolWheel";

const fresh: TeachContext = { taught: true, owned: [], quests: {} };
const wheelKinds = (c: TeachContext) => wheelContents({ site: "village", owned: [...c.owned, ...givenKeys(c.quests)], weapons: [], armed: false, pins: [], stock: {}, taught: c.taught }).map(i => i.kind);

describe("tools unlocked by people (row 312)", () => {
  it("pairs each taught tool with a resident on the roster, and leaves rows for the later tools", () => {
    const live = TOOL_TEACHERS.filter(t => t.live);
    expect(live.map(t => [t.tool, t.npc])).toEqual([["net", "curator"], ["shovel", "crafter"]]);
    expect(live.map(t => t.tool).sort()).toEqual([...TAUGHT_KINDS].sort());
    for (const t of TOOL_TEACHERS) if (t.npc) expect(PROPOSED_RESIDENTS.some(r => r.slug === t.npc), t.npc).toBe(true);
    for (const t of live) expect(toolByKey(t.key)?.tier).toBe(1);
    expect(TOOL_TEACHERS.filter(t => !t.live).map(t => t.tool)).toEqual(["axe", "dash", "glider"]);
  });

  it("walks one tool from start to finish: offer, hand-over, the quest in the tracker, the catch, yours", () => {
    let c = fresh;
    expect(wheelKinds(c)).toEqual(["rod"]);
    expect(toolQuest(c.quests)).toBeNull();
    // Odile offers her net.
    const talk = teacherTalk("curator", c)!;
    expect(talk).toMatchObject({ script: "tool:net:offer", tool: "net", lines: TOOL_LINES.net.offer });
    // The talk ends: she hands it over; the quest runs; the net is on the wheel at once.
    const given = handOver(talk.script, c.quests);
    expect(given).toBe("net");
    c = { ...c, quests: { ...c.quests, net: "given" } };
    expect(wheelKinds(c)).toEqual(["rod", "net"]);
    expect(toolQuest(c.quests)).toEqual({ id: "tool:net", title: "Odile's bug net", kind: "quest", steps: [{ id: "tool:net:bug", label: "Catch any bug", done: false }] });
    // Talking again while it runs: her nudge, and nothing handed over twice.
    expect(teacherTalk("curator", c)).toMatchObject({ script: "tool:net:during" });
    expect(handOver("tool:net:offer", c.quests)).toBeNull();
    // A fish or a forage find doesn't finish it; a bug does.
    expect(questFinished("fish", c.quests)).toBeNull();
    expect(questFinished("forage", c.quests)).toBeNull();
    expect(questFinished("bug", c.quests)).toBe("net");
    c = { ...c, quests: { ...c.quests, net: "done" } };
    expect(toolQuest(c.quests)).toBeNull();
    expect(wheelKinds(c)).toEqual(["rod", "net"]);
    // Done: Odile talks as she always does.
    expect(teacherTalk("curator", c)).toBeNull();
  });

  it("hands the shovel over at Pim's and finishes it with a dig", () => {
    const c = { ...fresh, quests: { net: "done" as const } };
    expect(teacherTalk("crafter", c)?.script).toBe("tool:shovel:offer");
    expect(questFinished("dig", { shovel: "given" })).toBe("shovel");
    expect(questFinished("bug", { shovel: "given" })).toBeNull();
  });

  it("never changes an existing player's residents or tools", () => {
    const old: TeachContext = { taught: false, owned: [], quests: {} };
    expect(teacherTalk("curator", old)).toBeNull();
    expect(teacherTalk("crafter", old)).toBeNull();
    expect(wheelKinds(old)).toEqual(["rod", "net", "shovel"]);
  });

  it("knows a tool already owned (given on another device, or bought): no offer for it", () => {
    expect(teacherTalk("curator", { ...fresh, owned: ["net-basic"] })).toBeNull();
    expect(teacherTalk("crafter", { ...fresh, owned: ["net-basic"] })?.tool).toBe("shovel");
    expect(teacherTalk("wren", fresh)).toBeNull();
    expect(teacherTalk("mayor", fresh)).toBeNull(); // the axe row is a placeholder
  });

  it("reads saved quests back safely", () => {
    expect(parseQuests({ net: "given", shovel: "done", axe: "given", glider: "nope" })).toEqual({ net: "given", shovel: "done" });
    expect(parseQuests("x")).toEqual({});
    expect(givenKeys({ net: "done", shovel: "given" })).toEqual(["net-basic", "shovel-basic"]);
  });
});
