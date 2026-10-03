"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Plus,
  GripVertical,
  Calendar,
  SquareKanban,
  MessageSquare,
  CheckSquare,
  Square,
} from "lucide-react";
import { Badge, Banner, Button, Empty, IconButton, Loading, Sheet, type BadgeTone } from "@/components/gui";

interface KanbanCard {
  id: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  position: number;
  column_id: string;
  checklist: { text: string; done: boolean }[] | null;
  assignees: { id: string; display_name: string }[];
  comments: { id: string; user_id: string; content: string; created_at: string; user: { display_name: string } }[];
}

interface KanbanColumn {
  id: string;
  name: string;
  position: number;
  cards: KanbanCard[];
}

interface Board {
  id: string;
  name: string;
}

/** Priority as a tag, quiet to loud: low, medium, high, urgent. */
const PRIORITY: Record<string, { tone: BadgeTone; label: string }> = {
  low: { tone: "neutral", label: "Low" },
  medium: { tone: "info", label: "Medium" },
  high: { tone: "warn", label: "High" },
  urgent: { tone: "danger", label: "Urgent" },
};

const formatDay = (iso: string, weekday = false) =>
  new Date(iso).toLocaleDateString("en-CA", {
    ...(weekday ? { weekday: "short" as const } : {}),
    month: "short",
    day: "numeric",
    timeZone: "America/Toronto",
  });

const PAGE_PAD = { padding: "24px 20px 48px" };

export default function KanbanPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);
  const [draggedCard, setDraggedCard] = useState<{ cardId: string; fromColumn: string } | null>(null);
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [newComment, setNewComment] = useState("");

  const fetchBoard = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("team_id")
      .eq("id", user.id)
      .single();

    if (!profile?.team_id) {
      setLoading(false);
      return;
    }

    const { data: boards } = await supabase
      .from("kanban_boards")
      .select("id, name")
      .eq("team_id", profile.team_id)
      .limit(1);

    if (!boards?.length) {
      setLoading(false);
      return;
    }

    setBoard(boards[0]);

    const { data: cols } = await supabase
      .from("kanban_columns")
      .select("id, name, position")
      .eq("board_id", boards[0].id)
      .order("position");

    if (!cols) {
      setLoading(false);
      return;
    }

    const { data: cards } = await supabase
      .from("kanban_cards")
      .select("id, title, description, priority, due_date, position, column_id, checklist, assignees:kanban_card_assignees(id:user_id, user:profiles(display_name))")
      .in("column_id", cols.map((c) => c.id))
      .order("position");

    const columnsWithCards: KanbanColumn[] = cols.map((col) => ({
      ...col,
      cards: (cards ?? [])
        .filter((card) => card.column_id === col.id)
        .map((card) => ({
          ...card,
          priority: card.priority as KanbanCard["priority"],
          checklist: card.checklist as KanbanCard["checklist"],
          assignees: ((card.assignees as unknown) as { id: string; user: { display_name: string } }[])?.map((a) => ({
            id: a.id,
            display_name: a.user?.display_name ?? "Unknown",
          })) ?? [],
          comments: [],
        })),
    }));

    setColumns(columnsWithCards);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, setState is after await
    fetchBoard();
  }, [fetchBoard]);

  const handleDragStart = (cardId: string, fromColumn: string) => {
    setDraggedCard({ cardId, fromColumn });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (toColumnId: string) => {
    if (!draggedCard || draggedCard.fromColumn === toColumnId) {
      setDraggedCard(null);
      return;
    }

    const supabase = createClient();

    setColumns((prev) => {
      const newCols = prev.map((col) => ({ ...col, cards: [...col.cards] }));
      const fromCol = newCols.find((c) => c.id === draggedCard.fromColumn);
      const toCol = newCols.find((c) => c.id === toColumnId);
      if (!fromCol || !toCol) return prev;

      const cardIdx = fromCol.cards.findIndex((c) => c.id === draggedCard.cardId);
      if (cardIdx === -1) return prev;

      const [card] = fromCol.cards.splice(cardIdx, 1);
      card.column_id = toColumnId;
      card.position = toCol.cards.length;
      toCol.cards.push(card);
      return newCols;
    });

    await supabase
      .from("kanban_cards")
      .update({ column_id: toColumnId, position: columns.find((c) => c.id === toColumnId)?.cards.length ?? 0 })
      .eq("id", draggedCard.cardId);

    setDraggedCard(null);
  };

  const addCard = async (columnId: string) => {
    if (!newCardTitle.trim()) return;
    const supabase = createClient();
    const col = columns.find((c) => c.id === columnId);

    const { data } = await supabase
      .from("kanban_cards")
      .insert({
        title: newCardTitle.trim(),
        column_id: columnId,
        position: col?.cards.length ?? 0,
        priority: "medium",
      })
      .select()
      .single();

    if (data) {
      setColumns((prev) =>
        prev.map((col) =>
          col.id === columnId
            ? {
                ...col,
                cards: [
                  ...col.cards,
                  { ...data, priority: data.priority as KanbanCard["priority"], checklist: null, assignees: [], comments: [] },
                ],
              }
            : col
        )
      );
    }

    setNewCardTitle("");
    setAddingToColumn(null);
  };

  const openCardDetail = async (card: KanbanCard) => {
    const supabase = createClient();
    const { data: comments } = await supabase
      .from("kanban_card_comments")
      .select("id, user_id, content, created_at, user:profiles(display_name)")
      .eq("card_id", card.id)
      .order("created_at");

    setSelectedCard({
      ...card,
      comments: (comments ?? []).map((c) => ({
        ...c,
        user: c.user as unknown as { display_name: string },
      })),
    });
  };

  const addComment = async () => {
    if (!newComment.trim() || !selectedCard) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("kanban_card_comments")
      .insert({ card_id: selectedCard.id, user_id: user.id, content: newComment.trim() })
      .select("id, user_id, content, created_at, user:profiles(display_name)")
      .single();

    if (data) {
      setSelectedCard((prev) =>
        prev
          ? {
              ...prev,
              comments: [
                ...prev.comments,
                { ...data, user: data.user as unknown as { display_name: string } },
              ],
            }
          : null
      );
    }
    setNewComment("");
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto" style={PAGE_PAD}>
        <Loading label="Loading your team’s board…" />
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex-1 overflow-y-auto" style={PAGE_PAD}>
        <Empty icon={<SquareKanban size={32} />} title="No board yet">
          You may not be on a team yet. Once your team has a board, it shows up here.
        </Empty>
      </div>
    );
  }

  const selectedPriority = selectedCard ? PRIORITY[selectedCard.priority] : undefined;

  return (
    <div className="flex-1 overflow-y-auto" style={PAGE_PAD}>
      <Banner title={board.name} icon={<SquareKanban size={26} />} tone="sage">
        Your team’s board. Drag a card to another column to move it along.
      </Banner>

      <div className="flex gap-4 overflow-x-auto pb-4 pt-1">
        {columns.map((col) => (
          <div
            key={col.id}
            className="min-w-[300px] w-[300px] shrink-0 flex flex-col max-h-[calc(100dvh-240px)]"
            style={{
              background: "var(--gui-paper-warm)",
              borderRadius: "var(--gui-r-card)",
              boxShadow: "var(--gui-shadow-sm), inset 0 0 0 1.5px var(--gui-paper-edge)",
            }}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(col.id)}
          >
            {/* Column Header */}
            <div
              className="flex items-center justify-between gap-2"
              style={{ padding: "8px 8px 8px 16px", borderBottom: "2px dashed var(--gui-paper-edge)" }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-sm truncate" style={{ color: "var(--gui-ink-strong)", fontWeight: 800 }}>
                  {col.name}
                </h2>
                <Badge>{col.cards.length}</Badge>
              </div>
              <IconButton label={`Add a card to ${col.name}`} size="sm" onClick={() => setAddingToColumn(col.id)}>
                <Plus size={18} aria-hidden />
              </IconButton>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
              {col.cards.map((card) => {
                const priority = PRIORITY[card.priority];
                return (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={() => handleDragStart(card.id, col.id)}
                    onClick={() => openCardDetail(card)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openCardDetail(card);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className="group cursor-pointer transition-transform hover:-translate-y-0.5"
                    style={{
                      background: "var(--gui-paper-hi)",
                      borderRadius: 14,
                      padding: 12,
                      boxShadow: "var(--gui-shadow-sm), inset 0 0 0 1.5px var(--gui-paper-edge)",
                      opacity: draggedCard?.cardId === card.id ? 0.55 : 1,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm leading-snug" style={{ color: "var(--gui-ink-strong)", fontWeight: 700 }}>
                        {card.title}
                      </p>
                      <GripVertical
                        size={14}
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                        style={{ color: "var(--gui-muted)" }}
                        aria-hidden
                      />
                    </div>

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {priority && <Badge tone={priority.tone}>{priority.label}</Badge>}

                      {card.due_date && (
                        <span className="flex items-center gap-1 text-xs" style={{ color: "var(--gui-muted)", fontWeight: 700 }}>
                          <Calendar size={12} aria-hidden />
                          {formatDay(card.due_date)}
                        </span>
                      )}
                    </div>

                    {card.assignees.length > 0 && (
                      <div className="flex items-center gap-1 mt-2">
                        {card.assignees.slice(0, 3).map((a) => (
                          <div
                            key={a.id}
                            className="w-6 h-6 rounded-full flex items-center justify-center"
                            style={{ background: "var(--gui-sage-soft)", boxShadow: "0 0 0 2px var(--gui-paper-hi)" }}
                            title={a.display_name}
                          >
                            <span className="text-xs" style={{ color: "var(--gui-sage-deep)", fontWeight: 800 }}>
                              {a.display_name?.[0]?.toUpperCase()}
                            </span>
                          </div>
                        ))}
                        {card.assignees.length > 3 && (
                          <span className="text-xs" style={{ color: "var(--gui-muted)", fontWeight: 700 }}>
                            +{card.assignees.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add Card Inline */}
              {addingToColumn === col.id && (
                <div
                  style={{
                    background: "var(--gui-paper-hi)",
                    borderRadius: 14,
                    padding: 10,
                    boxShadow: "inset 0 0 0 2px var(--gui-sage)",
                  }}
                >
                  <input
                    type="text"
                    value={newCardTitle}
                    onChange={(e) => setNewCardTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCard(col.id)}
                    placeholder="Card title…"
                    aria-label={`New card in ${col.name}`}
                    autoFocus
                    className="w-full bg-transparent text-sm placeholder:text-[var(--gui-muted)]"
                    style={{ color: "var(--gui-ink-strong)", fontWeight: 700, padding: "4px 6px" }}
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <Button size="sm" onClick={() => addCard(col.id)}>
                      Add card
                    </Button>
                    <Button
                      size="sm"
                      variant="quiet"
                      onClick={() => {
                        setAddingToColumn(null);
                        setNewCardTitle("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Card Detail Sheet */}
      <Sheet
        open={selectedCard !== null}
        onClose={() => setSelectedCard(null)}
        title={selectedCard?.title ?? ""}
        eyebrow={board.name}
        icon={<SquareKanban size={22} />}
        size="md"
        footer={selectedCard && (
          <div className="flex items-center gap-2 w-full">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addComment()}
              placeholder="Add a comment…"
              aria-label="Add a comment"
              className="flex-1 min-w-0 text-sm border-2 border-[var(--gui-paper-line)] focus:border-[var(--gui-sage)] placeholder:text-[var(--gui-muted)] transition-colors"
              style={{
                height: 40,
                padding: "0 16px",
                borderRadius: "var(--gui-r-pill)",
                background: "var(--gui-paper-hi)",
                color: "var(--gui-ink)",
                fontWeight: 600,
              }}
            />
            <Button size="sm" onClick={addComment}>
              Send
            </Button>
          </div>
        )}
      >
        {selectedCard && (
          <div className="space-y-5">
            {/* Priority + due date */}
            {(selectedPriority || selectedCard.due_date) && (
              <div className="flex flex-wrap items-center gap-3">
                {selectedPriority && <Badge tone={selectedPriority.tone}>{selectedPriority.label} priority</Badge>}
                {selectedCard.due_date && (
                  <span className="flex items-center gap-1.5 text-sm" style={{ color: "var(--gui-ink-2)", fontWeight: 700 }}>
                    <Calendar size={14} aria-hidden />
                    Due {formatDay(selectedCard.due_date, true)}
                  </span>
                )}
              </div>
            )}

            {/* Description */}
            {selectedCard.description && (
              <section>
                <h3 className="text-sm mb-1.5" style={{ color: "var(--gui-ink-strong)", fontWeight: 800 }}>
                  Description
                </h3>
                <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "var(--gui-ink)" }}>
                  {selectedCard.description}
                </p>
              </section>
            )}

            {/* Assignees */}
            {selectedCard.assignees.length > 0 && (
              <section>
                <h3 className="text-sm mb-2" style={{ color: "var(--gui-ink-strong)", fontWeight: 800 }}>
                  Assignees
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedCard.assignees.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-1.5"
                      style={{
                        background: "var(--gui-paper-warm)",
                        borderRadius: "var(--gui-r-pill)",
                        padding: "3px 12px 3px 3px",
                        boxShadow: "inset 0 0 0 1.5px var(--gui-paper-edge)",
                      }}
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ background: "var(--gui-sage-soft)" }}
                      >
                        <span className="text-xs" style={{ color: "var(--gui-sage-deep)", fontWeight: 800 }}>
                          {a.display_name?.[0]?.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm" style={{ color: "var(--gui-ink)", fontWeight: 700 }}>
                        {a.display_name}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Checklist */}
            {selectedCard.checklist && selectedCard.checklist.length > 0 && (
              <section>
                <h3 className="text-sm mb-2" style={{ color: "var(--gui-ink-strong)", fontWeight: 800 }}>
                  Checklist
                </h3>
                <ul className="space-y-1.5">
                  {selectedCard.checklist.map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      {item.done ? (
                        <CheckSquare size={16} className="shrink-0" style={{ color: "var(--gui-teal-ink)" }} aria-label="Done" />
                      ) : (
                        <Square size={16} className="shrink-0" style={{ color: "var(--gui-muted)" }} aria-label="Not done" />
                      )}
                      <span
                        className={item.done ? "line-through" : undefined}
                        style={{ color: item.done ? "var(--gui-muted)" : "var(--gui-ink)" }}
                      >
                        {item.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Comments */}
            <section>
              <h3 className="text-sm mb-2 flex items-center gap-1.5" style={{ color: "var(--gui-ink-strong)", fontWeight: 800 }}>
                <MessageSquare size={14} aria-hidden />
                Comments ({selectedCard.comments.length})
              </h3>
              {selectedCard.comments.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--gui-muted)" }}>
                  No comments yet. Add the first one below.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {selectedCard.comments.map((c) => (
                    <div
                      key={c.id}
                      style={{ background: "var(--gui-paper-warm)", borderRadius: 14, padding: "10px 12px" }}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs" style={{ color: "var(--gui-sage)", fontWeight: 800 }}>
                          {c.user?.display_name ?? "Unknown"}
                        </span>
                        <span className="text-xs" style={{ color: "var(--gui-muted)" }}>
                          {formatDay(c.created_at)}
                        </span>
                      </div>
                      <p className="text-sm" style={{ color: "var(--gui-ink)" }}>{c.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </Sheet>
    </div>
  );
}
