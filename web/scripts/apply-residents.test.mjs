import { describe, expect, it } from "vitest";
import { copyFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { createJiti } from "jiti";
import { FILES, literal, mentions, residentEdits, writeEdits } from "./apply-residents.mjs";
import { RESIDENT_BY_SLUG } from "./residentSources";
import { parseLook, wear } from "@/lib/game/character/look";

/** The sources copied to a scratch folder, edited there. */
function scratch() {
  const dir = mkdtempSync(join(tmpdir(), "apply-residents-"));
  return Object.fromEntries(Object.entries(FILES).map(([k, p]) => { const to = join(dir, `${k}.ts`); copyFileSync(p, to); return [k, to]; }));
}
/** A top-level const's value in a written file (its initializer evaluated; `as const` dropped). */
function constOf(path, name) {
  const ast = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
  for (const s of ast.statements) if (ts.isVariableStatement(s)) for (const d of s.declarationList.declarations) {
    if (d.name.getText() !== name) continue;
    let n = d.initializer;
    while (ts.isAsExpression(n)) n = n.expression;
    return new Function(`return (${n.getText()});`)();
  }
}
const base = slug => RESIDENT_BY_SLUG.get(slug).base;

describe("apply-residents (the Residents page's export into the sources)", () => {
  const marlo = parseLook(wear(wear({ ...base("marlo").look, skin: 7 }, "top", "top_tee"), "shoes", null));
  const chef = parseLook({ ...base("sushi-chef").look, back: "hair_bowl_cut", colors: { ...base("sushi-chef").look.colors, top_collar_shirt: 3 } });
  const docs = [
    { id: "wren", data: { display_name: "Ottilie" } },
    { id: "mayor", data: { bio: "Keeps the island's story.", tone: "", post: base("mayor").post } },
    { id: "shopkeeper", data: { schedule: { home: "shop", dawn: ["shop"], day: ["shop", "wharf"], evening: "plaza", night: ["home"] } } },
    { id: "nell", data: { talk: [["[happy] Hello.", "Look up."], ["@night The stars are out."]], canned_dialogue: ["One line."] } },
    { id: "marlo", data: { look: marlo } },
    { id: "cafe-owner", data: { display_name: "Rosalind", sweeper_lines: ["Not open yet!"] } },
    { id: "sushi-chef", data: { look: chef } },
    { id: "juniper", data: { display_name: base("juniper").display_name } },
  ];

  it("keeps only what changed", () => {
    const e = residentEdits(docs);
    expect(Object.keys(e).sort()).toEqual(["cafe-owner", "marlo", "mayor", "nell", "shopkeeper", "sushi-chef", "wren"]);
    expect(e.mayor).toEqual({ bio: "Keeps the island's story.", tone: "" });
    expect(residentEdits({ wren: { display_name: "Ottilie" } })).toEqual({ wren: { display_name: "Ottilie" } });
  });

  it("writes each value where the game reads it, and nothing else", async () => {
    const files = scratch(), changed = writeEdits(residentEdits(docs), files);
    expect(changed.sort()).toEqual([files.cafe, files.hqLines, files.roster, files.sushi, files.welcome].sort());
    // the roster through the module itself (its only import is a type)
    const roster = await createJiti(import.meta.url).import(files.roster);
    const row = slug => roster.PROPOSED_RESIDENTS.find(r => r.slug === slug);
    expect(row("wren").display_name).toBe("Ottilie");
    expect(row("mayor").bio).toBe("Keeps the island's story.");
    expect(row("mayor").tone).toBeNull();
    expect(row("shopkeeper").schedule).toEqual(docs[2].data.schedule);
    expect(row("nell").canned_dialogue).toEqual(["One line."]);
    expect(roster.RESIDENT_TALK.nell).toEqual(docs[3].data.talk);
    expect(row("nell").talk).toEqual(docs[3].data.talk);
    expect(parseLook(roster.RESIDENT_LOOKS.marlo)).toEqual(marlo);
    // everyone else as they were
    for (const r of roster.PROPOSED_RESIDENTS.filter(x => !["wren", "mayor", "shopkeeper", "nell"].includes(x.slug))) {
      const was = base(r.slug);
      expect([r.display_name, r.bio, r.schedule, r.canned_dialogue, r.talk]).toEqual([was.display_name, was.bio, was.schedule, was.canned_dialogue, was.talk]);
      if (r.slug !== "marlo") expect(parseLook(roster.RESIDENT_LOOKS[r.slug])).toEqual(was.look);
    }
    expect(constOf(files.cafe, "CAFE_OWNER").name).toBe("Rosalind");
    expect(constOf(files.cafe, "CAFE_OWNER").lines).toEqual(base("cafe-owner").canned_dialogue);
    expect(constOf(files.cafe, "SWEEPER_LINES")).toEqual(["Not open yet!"]);
    expect(parseLook(constOf(files.sushi, "CHEF_LOOK"))).toEqual(chef);
    expect(parseLook(constOf(files.sushi, "SERVER_LOOK"))).toEqual(base("sushi-server").look);
    // the HQ lead's name wherever the game spells it
    expect(constOf(files.welcome, "HQ_LEAD").name).toBe("Ottilie");
    expect(constOf(files.hqLines, "WREN").name).toBe("Ottilie");
    // comments stay
    expect(readFileSync(files.roster, "utf8")).toContain("// Flavour: sketches the island from the benches.");
  });

  it("writes literals the way the sources do", () => {
    expect(literal({ a: 1, "b-c": [null, "x"], d: {} })).toBe('{ a: 1, "b-c": [null, "x"], d: {} }');
  });

  it("refuses the whole export on an unknown resident, place, part, an empty name or a field that resident hasn't", () => {
    const refuses = (d, why) => expect(() => residentEdits(d)).toThrow(why);
    refuses({ jayden: { display_name: "J" } }, /jayden: not a resident/);
    refuses({ wren: { display_name: "  " } }, /Name: 1 to 80/);
    refuses({ wren: { display_name: "" } }, /Name/);
    refuses({ wren: { schedule: { day: ["hq", "volcano"] } } }, /day: volcano is not a place/);
    refuses({ wren: { schedule: { home: "pond" } } }, /Home: pond is not a building/);
    refuses({ wren: { schedule: { noon: ["hq"] } } }, /noon is not a time of day/);
    refuses({ wren: { look: { ...base("wren").look, top: "top_spacesuit" } } }, /Look: something the catalogue doesn't have \(top/);
    refuses({ wren: { look: { ...base("wren").look, acc: { face: "acc_cap" } } } }, /Look/);
    refuses({ "sushi-chef": { display_name: "Bancha" } }, /display_name is not editable/);
    refuses({ wren: { talk: [["a", "b", "c", "d", "e"]] } }, /.+/);
    refuses({ wren: { post: "mayor" } }, /Role/);
    // one bad doc stops the good ones too
    refuses([{ id: "wren", data: { display_name: "Ottilie" } }, { id: "nobody", data: {} }], /refused, nothing written/);
  });

  it("finds where an old name still shows in the game's text", () => {
    const hits = mentions(["Bram"]);
    expect(hits.some(([at]) => at.startsWith("lib/game/arrival/hq/lines.ts:"))).toBe(true);
    // in the game's text, not its comments
    expect(hits.every(([, l]) => !/^(\/\/|\*|\/\*|\{\/\*)/.test(l))).toBe(true);
    expect(mentions([])).toEqual([]);
  });
});
