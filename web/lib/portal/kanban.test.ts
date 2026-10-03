import { describe, expect, it } from "vitest";
import { addComment, loadBoard, loadComments, moveCard } from "./kanban";
import { fakeDb } from "./testDb";

const ME = "00000000-0000-4000-8000-0000000000aa";
const card = (id: string, column_id: string, position: number, extra = {}) => ({
  id, column_id, position, title: `Card ${id}`, description: null, priority: "medium", due_date: null, created_by: ME, created_at: "2026-10-01T12:00:00Z", updated_at: "2026-10-01T12:00:00Z", ...extra,
});
const rows = () => ({
  profiles: [{ id: ME, team_id: "team-1", display_name: "Maya" }],
  kanban_boards: [{ id: "board-1", team_id: "team-1", name: "ArkAid sprint", created_at: "2026-09-01T12:00:00Z" }],
  kanban_columns: [
    { id: "col-todo", board_id: "board-1", name: "To do", position: 0, created_at: "2026-09-01T12:00:00Z" },
    { id: "col-done", board_id: "board-1", name: "Done", position: 1, created_at: "2026-09-01T12:00:00Z" },
  ],
  kanban_cards: [
    card("c1", "col-todo", 0, {
      // As PostgREST embeds the checklist's own table and the assignees' profiles.
      checklist: [{ id: "k2", title: "Write tests", is_completed: false, position: 1 }, { id: "k1", title: "Sketch the API", is_completed: true, position: 0 }],
      assignees: [{ id: ME, user: { display_name: "Maya" } }],
    }),
    card("c2", "col-todo", 1, { checklist: [], assignees: [] }),
    card("c3", "col-done", 0, { checklist: [], assignees: [] }),
  ],
  kanban_card_comments: [{ id: "m1", card_id: "c1", user_id: ME, body: "Started on this", created_at: "2026-10-02T12:00:00Z", user: { display_name: "Maya" } }],
});

describe("the team board (#22)", () => {
  it("loads the columns with their cards, each card's checklist from kanban_card_checklist", async () => {
    const r = await loadBoard(fakeDb(rows()).db);
    expect(r?.board?.name).toBe("ArkAid sprint");
    expect(r?.columns.map((c) => [c.name, c.cards.map((k) => k.id)])).toEqual([["To do", ["c1", "c2"]], ["Done", ["c3"]]]);
    expect(r?.columns[0].cards[0].checklist).toEqual([{ id: "k1", text: "Sketch the API", done: true }, { id: "k2", text: "Write tests", done: false }]);
    expect(r?.columns[0].cards[0].assignees).toEqual([{ id: ME, display_name: "Maya" }]);
  });
  it("reads and writes comments in body", async () => {
    const f = fakeDb(rows());
    expect((await loadComments(f.db, "c1")).map((c) => c.body)).toEqual(["Started on this"]);
    const added = await addComment(f.db, "c1", "Done, pushed");
    expect(added?.body).toBe("Done, pushed");
    expect(f.writes.at(-1)).toMatchObject({ table: "kanban_card_comments", op: "insert", row: { card_id: "c1", user_id: ME, body: "Done, pushed" } });
  });
  it("throws a failed read rather than showing an empty board", async () => {
    await expect(loadBoard(fakeDb(rows(), { down: ["kanban_cards"] }).db)).rejects.toThrow();
    expect(await loadBoard(fakeDb(rows(), { userId: null }).db)).toBeNull();
  });
  it("moves a card to the end of another column", () => {
    const cols = [{ id: "a", name: "A", position: 0, cards: [card("x", "a", 0), card("y", "a", 1)] }, { id: "b", name: "B", position: 1, cards: [card("z", "b", 0)] }] as never;
    const moved = moveCard(cols, "x", "b");
    expect(moved?.position).toBe(1);
    expect(moved?.columns.map((c) => c.cards.map((k) => `${k.id}@${k.column_id}:${k.position}`))).toEqual([["y@a:1"], ["z@b:0", "x@b:1"]]);
    expect(moveCard(cols, "x", "a")).toBeNull();
    expect(moveCard(cols, "nope", "b")).toBeNull();
  });
});
