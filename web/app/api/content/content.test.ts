/**
 * The new editors (residents, recipes) publish through the content pipeline:
 * validated draft → publish snapshots the live row into content_versions
 * (rollback + activity log) → the live row changes. Text-keyed recipes too.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

type Row = Record<string, unknown>;
const mock = vi.hoisted(() => ({ ctx: null as unknown, tables: {} as Record<string, Row[]> }));
vi.mock("@/lib/server/memberContext", async (original) => ({
  ...(await original<typeof import("@/lib/server/memberContext")>()),
  memberContext: async () => mock.ctx,
}));

import { POST as saveDraft } from "./drafts/route";
import { POST as publish } from "./drafts/[id]/publish/route";

// Just enough of the Supabase query builder over in-memory tables.
let seq = 0;
function from(table: string) {
  const rows = (mock.tables[table] ??= []);
  const eqs: [string, unknown][] = [];
  let patch: Row | null = null;
  let added: Row | null = null;
  const hit = () => rows.filter((r) => eqs.every(([c, v]) => r[c] === v));
  const b = {
    select: () => b,
    eq: (c: string, v: unknown) => (eqs.push([c, v]), b),
    insert: (row: Row) => ((added = { id: `row-${++seq}`, ...row }), rows.push(added), b),
    update: (p: Row) => ((patch = p), b),
    maybeSingle: async () => ({ data: hit()[0] ? { ...hit()[0] } : null, error: null }),
    single: async () => ({ data: added ?? hit()[0] ?? null, error: null }),
    then: (resolve: (v: { error: null }) => void) => {
      if (patch) hit().forEach((r) => Object.assign(r, patch));
      resolve({ error: null });
    },
  };
  return b;
}
const T1 = "00000000-0000-4000-8000-0000000000a1";
const post = (body: unknown) => saveDraft(new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) }));
const publishDraft = (id: string) => publish(new Request("http://localhost/api", { method: "POST" }), { params: Promise.resolve({ id }) });
const RECIPE = { id: "rod-glass", output_item: "rod-glass", output_weapon: null, output_qty: 1, ingredients: { wood_branch: 4, rock_crystal: 1 }, sources: ["bottle"], position: 1, active: true };

beforeEach(() => {
  mock.tables = { crafting_recipes: [{ ...RECIPE }], npc_personas: [], content_drafts: [], content_versions: [] };
  mock.ctx = { userId: T1, tier: 1, now: new Date(), db: { from } };
});

describe("content editors publish through versioning", () => {
  it("refuses invalid recipe and resident drafts before storing them", async () => {
    expect((await post({ table_name: "crafting_recipes", row_id: "rod-glass", draft_data: { ...RECIPE, ingredients: {} } })).status).toBe(400);
    expect((await post({ table_name: "crafting_recipes", row_id: null, draft_data: { ...RECIPE, output_weapon: "sword-iron" } })).status).toBe(400);
    expect((await post({ table_name: "npc_personas", row_id: null, draft_data: { slug: "kit", display_name: "Kit", schedule: { night: "moon" } } })).status).toBe(400);
    expect((await post({ table_name: "npc_personas", row_id: null, draft_data: { slug: "kit", display_name: "Kit", post: "wizard" } })).status).toBe(400);
    expect(mock.tables.content_drafts).toHaveLength(0);
  });

  it("publishes a recipe edit: snapshot of the text-keyed row, then the live change", async () => {
    const saved = await post({ table_name: "crafting_recipes", row_id: "rod-glass", draft_data: { ...RECIPE, output_qty: 2, ingredients: { wood_branch: 3 } } });
    expect(saved.status).toBe(201);
    const { draft } = await saved.json();
    expect(draft).toMatchObject({ author: T1, status: "draft", row_id: "rod-glass" });
    expect((await publishDraft(draft.id)).status).toBe(200);
    expect(mock.tables.content_versions).toEqual([expect.objectContaining({ table_name: "crafting_recipes", row_id: "rod-glass", published_by: T1, snapshot_data: expect.objectContaining({ output_qty: 1 }) })]);
    expect(mock.tables.crafting_recipes[0]).toMatchObject({ output_qty: 2, ingredients: { wood_branch: 3 } });
    expect(mock.tables.content_drafts[0]).toMatchObject({ status: "published" });
    expect((await publishDraft(draft.id)).status).toBe(409);
  });

  it("publishes a new resident with a schedule", async () => {
    const saved = await post({ table_name: "npc_personas", row_id: null, draft_data: { slug: "kit", display_name: "Kit", post: "wharf_keeper", tone: "dry", bio: "Keeps the wharf.", canned_dialogue: ["Tide's in."], schedule: { day: "wharf", night: "hq" } } });
    expect(saved.status).toBe(201);
    expect((await publishDraft((await saved.json()).draft.id)).status).toBe(200);
    expect(mock.tables.npc_personas).toEqual([expect.objectContaining({ slug: "kit", schedule: { day: "wharf", night: "hq" } })]);
    expect(mock.tables.content_versions).toHaveLength(0);
  });
});

describe("resident conversations (reachability deliverable 1): T1/T2 only, checked on the server", () => {
  const TALK = { slug: "kit", display_name: "Kit", post: "wharf_keeper", canned_dialogue: ["Tide's in."], talk: [["[happy] Oh! Hello.", "Tide's turning."], ["Boat's ready."]] };
  const as = (tier: number) => { mock.ctx = { userId: T1, tier, now: new Date(), db: { from } }; };

  it("refuses T3 to T5 and signed-out visitors before anything is stored or published", async () => {
    mock.tables.content_drafts.push({ id: "d-1", table_name: "npc_personas", row_id: null, draft_data: TALK, status: "draft" });
    for (const tier of [3, 4, 5]) {
      as(tier);
      expect((await post({ table_name: "npc_personas", row_id: null, draft_data: TALK })).status).toBe(403);
      expect((await publishDraft("d-1")).status).toBe(403);
    }
    mock.ctx = NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    expect((await post({ table_name: "npc_personas", row_id: null, draft_data: TALK })).status).toBe(401);
    expect((await publishDraft("d-1")).status).toBe(401);
    expect(mock.tables.content_drafts).toHaveLength(1);
    expect(mock.tables.npc_personas).toHaveLength(0);
  });

  it("refuses conversations the game can't say (an unknown expression, a fifth box, an empty line)", async () => {
    as(2);
    for (const talk of [[["[wizard] Hm."]], [["a", "b", "c", "d", "e"]], [["  "]], "Hello"]) {
      expect((await post({ table_name: "npc_personas", row_id: null, draft_data: { ...TALK, talk } })).status).toBe(400);
    }
    expect(mock.tables.content_drafts).toHaveLength(0);
  });

  it("a T2's edit publishes: the old conversations kept in the history, the new ones live", async () => {
    as(2);
    mock.tables.npc_personas.push({ id: "p-kit", ...TALK, talk: [["Old line."]] });
    const saved = await post({ table_name: "npc_personas", row_id: "p-kit", draft_data: TALK });
    expect(saved.status).toBe(201);
    expect((await publishDraft((await saved.json()).draft.id)).status).toBe(200);
    expect(mock.tables.npc_personas[0].talk).toEqual(TALK.talk);
    expect(mock.tables.content_versions[0]).toMatchObject({ table_name: "npc_personas", row_id: "p-kit", snapshot_data: expect.objectContaining({ talk: [["Old line."]] }) });
  });
});

