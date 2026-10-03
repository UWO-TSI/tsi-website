/** The team board's data (kanban_* tables, 001_initial_schema): checklists live in kanban_card_checklist, comments in body. */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ChecklistItem { id: string; text: string; done: boolean }
export interface KanbanCard {
  id: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  position: number;
  column_id: string;
  checklist: ChecklistItem[];
  assignees: { id: string; display_name: string }[];
}
export interface KanbanColumn { id: string; name: string; position: number; cards: KanbanCard[] }
export interface KanbanComment { id: string; user_id: string; body: string; created_at: string; user: { display_name: string } | null }

type CardRow = Omit<KanbanCard, "checklist" | "assignees"> & {
  checklist: { id: string; title: string; is_completed: boolean; position: number }[] | null;
  assignees: { id: string; user: { display_name: string } | null }[] | null;
};

const CARD_COLUMNS = "id, title, description, priority, due_date, position, column_id, "
  + "checklist:kanban_card_checklist(id, title, is_completed, position), assignees:kanban_card_assignees(id:user_id, user:profiles(display_name))";
const COMMENT_COLUMNS = "id, user_id, body, created_at, user:profiles(display_name)";

const must = <T>(r: { data: T; error: { message: string } | null }): T => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};

/** Your team's first board with its columns and cards; `board` null without a team or a board; null signed out. */
export async function loadBoard(db: SupabaseClient): Promise<{ board: { id: string; name: string } | null; columns: KanbanColumn[] } | null> {
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const profile = must(await db.from("profiles").select("team_id").eq("id", user.id).maybeSingle());
  if (!profile?.team_id) return { board: null, columns: [] };
  const boards = must(await db.from("kanban_boards").select("id, name").eq("team_id", profile.team_id).limit(1)) ?? [];
  if (!boards.length) return { board: null, columns: [] };
  const cols = must(await db.from("kanban_columns").select("id, name, position").eq("board_id", boards[0].id).order("position")) ?? [];
  const rows = (must(await db.from("kanban_cards").select(CARD_COLUMNS).in("column_id", cols.map((c) => c.id)).order("position")) ?? []) as unknown as CardRow[];
  const cards: KanbanCard[] = rows.map((c) => ({
    ...c,
    checklist: [...(c.checklist ?? [])].sort((a, b) => a.position - b.position).map((i) => ({ id: i.id, text: i.title, done: i.is_completed })),
    assignees: (c.assignees ?? []).map((a) => ({ id: a.id, display_name: a.user?.display_name ?? "Unknown" })),
  }));
  return { board: boards[0], columns: cols.map((col) => ({ ...col, cards: cards.filter((c) => c.column_id === col.id) })) };
}

export async function loadComments(db: SupabaseClient, cardId: string): Promise<KanbanComment[]> {
  return (must(await db.from("kanban_card_comments").select(COMMENT_COLUMNS).eq("card_id", cardId).order("created_at")) ?? []) as unknown as KanbanComment[];
}

export async function addComment(db: SupabaseClient, cardId: string, body: string): Promise<KanbanComment> {
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Sign in to comment.");
  return must(await db.from("kanban_card_comments").insert({ card_id: cardId, user_id: user.id, body }).select(COMMENT_COLUMNS).single()) as unknown as KanbanComment;
}

/** The board with `cardId` moved to the end of `toColumnId`, and its new position; null when nothing moves. */
export function moveCard(columns: KanbanColumn[], cardId: string, toColumnId: string): { columns: KanbanColumn[]; position: number } | null {
  const from = columns.find((c) => c.cards.some((k) => k.id === cardId));
  const to = columns.find((c) => c.id === toColumnId);
  if (!from || !to || from === to) return null;
  const card = from.cards.find((k) => k.id === cardId)!;
  const position = to.cards.length;
  return {
    position,
    columns: columns.map((c) =>
      c === from ? { ...c, cards: c.cards.filter((k) => k !== card) }
        : c === to ? { ...c, cards: [...c.cards, { ...card, column_id: toColumnId, position }] }
        : c),
  };
}
